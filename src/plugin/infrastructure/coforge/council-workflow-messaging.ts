import type {
  CouncilCatalogueActions,
  CouncilCatalogueSnapshot,
} from "../../features/coforge/application/council-catalogue";
import {
  decodeCouncilPlan,
  resolveCouncilPlan,
} from "../../features/coforge/application/council-execution";
import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import {
  decodeWorkflowV2Plan,
  isWorkflowV2Run,
  workflowV2MessageDraft,
} from "../../features/coforge/application/workflow-v2-execution";
import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
} from "../../features/coforge/domain/execution-outbox";
import type {
  ExecutionJournal,
  ExecutionRun,
} from "../../features/coforge/domain/execution-run";
import type { ExecutionLocalAction } from "../../features/coforge/domain/execution-local-action";
import type {
  MessageAuthority,
  MessageRecipient,
  TeamMessage,
} from "../../features/coforge/domain/team-messages";
import { ExecutionBlockError } from "../../features/coforge/domain/execution-block";
import { effectiveExecutionAllowance } from '../../features/coforge/domain/execution-allowance';

export const workflowMessageSender = (run: ExecutionRun): string =>
  `workflow-${run.id}`;
/** Workflow authors choose destinations, while live team grants remain outside the captured body/template. */
export function workflowMessageAllowed(
  message: TeamMessage,
  run: ExecutionRun,
  snapshot: CouncilCatalogueSnapshot,
): boolean {
  if (
    !isWorkflowV2Run(run) ||
    message.senderId !== workflowMessageSender(run) ||
    message.runId !== run.id ||
    run.projectId !== message.projectId ||
    run.teamId !== message.teamId
  )
    return false;
  const plan = decodeWorkflowV2Plan(run);
  const action = plan.localActions.find(
    (item) => `local-${item.id}` === message.attemptId,
  );
  const team = snapshot.valid.find(
    (item) => item.definition.id === run.teamId,
  )?.definition;
  const target = snapshot.valid.find(
    (item) => item.definition.id === message.recipientId,
  )?.definition;
  if (
    !action ||
    action.recipientId !== message.recipientId ||
    action.purpose !== message.purpose ||
    !team?.enabled ||
    team.schema !== "team/v1" ||
    team.projectId !== run.projectId ||
    !team.allowedRecipients.includes(message.recipientId) ||
    !plan.catalogue.team.allowedRecipients.includes(message.recipientId) ||
    !target?.enabled
  )
    return false;
  return target.schema === "agent/v1"
    ? team.members.includes(target.id) &&
        plan.catalogue.team.members.includes(target.id)
    : target.projectId === run.projectId &&
        (target.schema === "team/v1"
          ? target.id === run.teamId
          : target.teamId === run.teamId);
}

/** Preparing can read current definitions; committing is a pure journal mutation with the local-action evidence. */
export class CouncilWorkflowMessaging {
  private readonly authorities = new Map<string, MessageAuthority>();
  constructor(
    private readonly kernel: ExecutionKernel,
    private readonly catalogue: CouncilCatalogueActions,
  ) {}
  async prepare(
    run: ExecutionRun,
    action: ExecutionLocalAction,
  ): Promise<void> {
    const plan = decodeWorkflowV2Plan(run);
    const snapshot = await this.catalogue.list();
    const draft = workflowV2MessageDraft(run, action);
    const team = snapshot.valid.find(
      (item) => item.definition.id === run.teamId,
    )?.definition;
    const target = snapshot.valid.find(
      (item) => item.definition.id === action.recipientId,
    )?.definition;
    if (
      !team?.enabled ||
      team.schema !== "team/v1" ||
      team.projectId !== run.projectId ||
      !team.allowedRecipients.includes(action.recipientId) ||
      !plan.catalogue.team.allowedRecipients.includes(action.recipientId) ||
      !target?.enabled
    )
      throw new Error("The workflow message recipient grant is unavailable.");
    let recipient: MessageRecipient;
    if (target.schema === "team/v1")
      recipient = {
        id: target.id,
        kind: "team",
        projectId: target.projectId,
        teamId: target.id,
        enabled: true,
        expectedInvocations: 0,
      };
    else {
      const child = resolveCouncilPlan(snapshot, {
        kind: target.schema === "agent/v1" ? "agent" : "council",
        id: target.id,
        teamId: run.teamId,
      });
      recipient = {
        id: target.id,
        kind: target.schema === "agent/v1" ? "agent" : "council",
        projectId: child.definition.projectId,
        teamId: child.team.id,
        enabled: true,
        expectedInvocations: child.invocations.length,
      };
    }
    const journal = this.kernel.snapshot();
    const parent = journal.messaging?.outbox.find(
      (entry) => entry.message.id === run.subject.sourceId,
    )?.message;
    const root = parent
      ? journal.messaging?.roots.find((item) => item.id === parent.rootId)
      : journal.messaging?.roots.find((item) => item.id === run.id);
    if (root?.stopped) throw new ExecutionBlockError("root-stopped");
    const ancestors = new Set<string>([
      workflowMessageSender(run),
      run.projectId,
    ]);
    let ancestor = parent;
    const visited = new Set<string>();
    while (ancestor) {
      if (visited.has(ancestor.id) || visited.size >= 100)
        throw new Error("The workflow message lineage is invalid.");
      visited.add(ancestor.id);
      ancestors.add(ancestor.senderId);
      const origin = journal.runs.find((item) => item.id === ancestor?.runId);
      if (origin)
        ancestors.add(
          isWorkflowV2Run(origin)
            ? origin.projectId
            : decodeCouncilPlan(origin).definition.id,
        );
      ancestor = origin
        ? journal.messaging?.outbox.find(
            (entry) => entry.message.id === origin.subject.sourceId,
          )?.message
        : undefined;
    }
    const authority: MessageAuthority = {
      rootId: parent?.rootId ?? run.id,
      runId: run.id,
      attemptId: `local-${action.id}`,
      senderId: workflowMessageSender(run),
      projectId: run.projectId,
      teamId: run.teamId,
      threadId: parent?.threadId ?? run.id,
      now: new Date().toISOString(),
      ...(root?.deadline ? { deadline: root.deadline } : {}),
      depth: parent?.depth ?? 0,
      activeAncestors: [...ancestors],
      allowedRecipients: [action.recipientId],
      recipients: [recipient],
      stopped: root?.stopped ?? false,
      limits: root?.limits ?? {
        depth: 3,
        descendants: 10,
        messages: 10,
        invocations: effectiveExecutionAllowance(run).maxInvocations,
      },
      usage: root?.usage ?? {
        descendants: 0,
        messages: 0,
        invocations: run.invocations.length,
      },
      replyMessages:
        journal.messaging?.outbox
          .filter((entry) => entry.status === "delivered")
          .map((entry) => entry.message) ?? [],
      actingRecipientIds: [run.projectId],
    };
    // Pure validation now prevents a malformed request from reaching the durable local-action transaction.
    commitExecutionMessages(
      journal.messaging ?? emptyExecutionMessagingState(),
      authority,
      [draft],
    );
    this.authorities.set(`${run.id}:${action.id}`, authority);
  }
  commit(
    journal: ExecutionJournal,
    run: ExecutionRun,
    action: ExecutionLocalAction,
  ): string[] {
    const authority = this.authorities.get(`${run.id}:${action.id}`);
    if (!authority)
      throw new Error(
        "Recheck the workflow message policy before committing its action.",
      );
    const previousIds = new Set(
      journal.messaging?.outbox.map((entry) => entry.message.id) ?? [],
    );
    journal.messaging = commitExecutionMessages(
      journal.messaging ?? emptyExecutionMessagingState(),
      authority,
      [workflowV2MessageDraft(run, action)],
    );
    return journal.messaging.outbox
      .filter(
        (entry) =>
          !previousIds.has(entry.message.id) ||
          (entry.message.runId === run.id &&
            entry.message.attemptId === authority.attemptId),
      )
      .map((entry) => entry.message.id);
  }
}
