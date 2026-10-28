import { ExecutionBlockError } from "../../features/coforge/domain/execution-block";
import { ExecutionMessageRejection } from "../../features/coforge/domain/execution-message-rejection";
import { executionMessagingPlan } from "../../features/coforge/application/execution-messaging-plan";
import type { Plugin } from "obsidian";
import type { CouncilCatalogueActions } from "../../features/coforge/application/council-catalogue";
import {
  resolveCouncilPlan,
  type CouncilTarget,
} from "../../features/coforge/application/council-execution";
import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import { JournalTeamMessages } from "../../features/coforge/application/journal-team-messages";
import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
} from "../../features/coforge/domain/execution-outbox";
import type {
  ExecutionAttempt,
  ExecutionInvocation,
  ExecutionJournal,
  ExecutionRun,
} from "../../features/coforge/domain/execution-run";
import {
  selectTeamContext,
  type MessageAuthority,
  type TeamMessageDraft,
  type MessageRecipient,
} from "../../features/coforge/domain/team-messages";
import {
  CouncilMessageRouting,
  type CouncilWorkflowRecipientPort,
} from "./council-message-routing";

/** Message authority is constructed from host snapshots; model drafts supply only purpose/recipient/body. */
export class CouncilMessagingModule {
  readonly service: JournalTeamMessages;
  private readonly authorities = new Map<string, MessageAuthority>();
  constructor(
    plugin: Plugin,
    private readonly kernel: ExecutionKernel,
    private readonly catalogue: CouncilCatalogueActions,
    protect: (paths: string[]) => Promise<void>,
    submit: (
      target: CouncilTarget,
      path: string,
      key: string,
    ) => Promise<ExecutionRun>,
    private readonly workflow?: CouncilWorkflowRecipientPort,
  ) {
    this.service = new JournalTeamMessages(
      kernel,
      new CouncilMessageRouting(
        plugin,
        kernel,
        catalogue,
        protect,
        submit,
        workflow,
      ),
    );
  }
  async prepare(
    run: ExecutionRun,
    invocation: ExecutionInvocation,
    attempt: ExecutionAttempt,
  ): Promise<void> {
    const active = new Set(
      this.kernel
        .snapshot()
        .runs.flatMap((item) =>
          item.attempts
            .filter((attempt) => attempt.status === "dispatching")
            .map((attempt) => attempt.id),
        ),
    );
    for (const id of this.authorities.keys())
      if (!active.has(id)) this.authorities.delete(id);
    const plan = executionMessagingPlan(run);
    const snapshot = await this.catalogue.list();
    const currentAgent = snapshot.valid.find(
      (item) => item.definition.id === invocation.agentId,
    )?.definition;
    const pinnedAgent = plan.agent(invocation);
    const currentTeam = snapshot.valid.find(
      (item) => item.definition.id === run.teamId,
    )?.definition;
    const allowed =
      currentAgent?.schema === "agent/v1" &&
      currentAgent.enabled &&
      currentAgent.requestedCapabilities.messaging &&
      pinnedAgent?.requestedCapabilities.messaging &&
      currentTeam?.schema === "team/v1"
        ? plan.team.allowedRecipients.filter((id) =>
            currentTeam.allowedRecipients.includes(id),
          )
        : [];
    const recipients: MessageRecipient[] = [];
    for (const id of allowed) {
      const definition = snapshot.valid.find(
        (item) => item.definition.id === id,
      )?.definition;
      if (!definition) {
        const recipient = await this.workflow?.resolve(id, run.teamId);
        if (recipient) recipients.push(recipient);
        continue;
      }
      if (!definition.enabled) continue;
      if (definition.schema === "team/v1") {
        recipients.push({
          id,
          kind: "team",
          projectId: definition.projectId,
          teamId: definition.id,
          enabled: true,
          expectedInvocations: 0,
        });
      } else {
        try {
          const child = resolveCouncilPlan(snapshot, {
            kind: definition.schema === "agent/v1" ? "agent" : "council",
            id,
            teamId: run.teamId,
          });
          recipients.push({
            id,
            kind: definition.schema === "agent/v1" ? "agent" : "council",
            projectId: child.definition.projectId,
            teamId: child.team.id,
            enabled: true,
            expectedInvocations: child.invocations.length,
          });
        } catch {
          /* Invalid targets remain unavailable; no routing authority comes from text. */
        }
      }
    }
    const journal = this.kernel.snapshot();
    const parent = journal.messaging?.outbox.find(
      (entry) => entry.message.id === run.subject.sourceId,
    )?.message;
    const root = parent
      ? journal.messaging?.roots.find((root) => root.id === parent.rootId)
      : undefined;
    const ancestors = new Set<string>([invocation.agentId, plan.definitionId]);
    let ancestor = parent;
    const visited = new Set<string>();
    while (ancestor) {
      if (visited.has(ancestor.id) || visited.size >= 100)
        throw new Error("The conversation lineage is invalid.");
      visited.add(ancestor.id);
      ancestors.add(ancestor.senderId);
      const ancestorRun = journal.runs.find(
        (item) => item.id === ancestor?.runId,
      );
      if (ancestorRun)
        ancestors.add(executionMessagingPlan(ancestorRun).definitionId);
      ancestor = ancestorRun
        ? journal.messaging?.outbox.find(
            (entry) => entry.message.id === ancestorRun.subject.sourceId,
          )?.message
        : undefined;
    }
    const limits = plan.limits;
    this.authorities.set(attempt.id, {
      rootId: parent?.rootId ?? run.id,
      runId: run.id,
      attemptId: attempt.id,
      senderId: invocation.agentId,
      projectId: run.projectId,
      teamId: run.teamId,
      threadId: parent?.threadId ?? run.id,
      now: new Date().toISOString(),
      ...(root?.deadline ? { deadline: root.deadline } : {}),
      depth: parent?.depth ?? 0,
      activeAncestors: [...ancestors],
      allowedRecipients: allowed,
      recipients,
      replyMessages:
        journal.messaging?.outbox
          .filter((entry) => entry.status === "delivered")
          .map((entry) => entry.message) ?? [],
      actingRecipientIds: [invocation.agentId, plan.definitionId],
      stopped: root?.stopped ?? false,
      limits: root?.limits ?? {
        depth: limits.maxDelegationDepth,
        descendants: limits.maxDescendantRuns,
        messages: limits.maxGeneratedMessages,
        invocations: limits.maxInvocations,
      },
      usage: root?.usage ?? {
        descendants: 0,
        messages: 0,
        invocations: run.invocations.length,
      },
    });
  }
  commit(
    journal: ExecutionJournal,
    attempt: ExecutionAttempt,
    drafts: readonly TeamMessageDraft[],
  ): void {
    const authority = this.authorities.get(attempt.id);
    if (!authority) throw new ExecutionMessageRejection("unavailable");
    journal.messaging = commitExecutionMessages(
      journal.messaging ?? emptyExecutionMessagingState(),
      authority,
      drafts,
    );
    this.authorities.delete(attempt.id);
  }
  allowedRecipients(attemptId: string): string[] {
    return [...(this.authorities.get(attemptId)?.allowedRecipients ?? [])];
  }
  invalidateAuthority(attemptId: string): void {
    this.authorities.delete(attemptId);
  }
  assertRunAllowed(run: ExecutionRun): void {
    const journal = this.kernel.snapshot();
    const origin = journal.messaging?.outbox.find(
      (entry) => entry.message.id === run.subject.sourceId,
    )?.message;
    const root = journal.messaging?.roots.find(
      (item) => item.id === (origin?.rootId ?? run.id),
    );
    if (root?.stopped) throw new ExecutionBlockError("root-stopped");
  }
  async stop(rootId: string): Promise<void> {
    await this.service.stop(rootId);
    const journal = this.kernel.snapshot();
    const sources = new Set(
      journal.messaging?.outbox
        .filter((entry) => entry.message.rootId === rootId)
        .map((entry) => entry.message.id) ?? [],
    );
    for (const run of journal.runs.filter(
      (item) =>
        (item.id === rootId || sources.has(item.subject.sourceId)) &&
        !["completed", "cancelled"].includes(item.state),
    ))
      await this.kernel.cancel(run.id);
  }
  async postInformation(
    teamId: string,
    body: string,
    stableDeliveryId?: string,
  ): Promise<void> {
    const team = (await this.catalogue.list()).valid.find(
      (item) => item.definition.id === teamId,
    )?.definition;
    if (!team || team.schema !== "team/v1" || !team.enabled)
      throw new Error("Select an available team.");
    const id = stableDeliveryId ?? crypto.randomUUID();
    const now = new Date().toISOString();
    await this.service.enqueue(
      [{ purpose: "information", recipientId: team.id, body }],
      {
        rootId: id,
        runId: id,
        attemptId: id,
        senderId: "operator",
        projectId: team.projectId,
        teamId,
        threadId: id,
        now,
        depth: 0,
        activeAncestors: [],
        allowedRecipients: [team.id],
        recipients: [
          {
            id: team.id,
            kind: "team",
            projectId: team.projectId,
            teamId,
            enabled: true,
            expectedInvocations: 0,
          },
        ],
        stopped: false,
        limits: { depth: 0, descendants: 0, messages: 1, invocations: 0 },
        usage: { descendants: 0, messages: 0, invocations: 0 },
      },
    );
    await this.service.flush();
  }
  context(
    teamId: string,
    projectId: string,
    recentLimit: number,
    maxCharacters: number,
  ) {
    return selectTeamContext(
      this.service
        .messages()
        .filter((entry) => entry.status === "delivered")
        .map((entry) => entry.message),
      { teamId, projectId, pinned: [], recentLimit, maxCharacters },
    );
  }
}
