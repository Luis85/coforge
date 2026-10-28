import type { Plugin } from "obsidian";
import type { CouncilCatalogueActions } from "../../features/coforge/application/council-catalogue";
import {
  resolveCouncilPlan,
  type CouncilTarget,
} from "../../features/coforge/application/council-execution";
import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import { isWorkflowV2Run } from "../../features/coforge/application/workflow-v2-execution";
import type { ExecutionRun } from "../../features/coforge/domain/execution-run";
import type {
  TeamMessage,
  MessageOutboxEntry,
  MessageRecipient,
} from "../../features/coforge/domain/team-messages";
import type { JournalMessageDelivery } from "../../features/coforge/application/journal-team-messages";
import { CouncilMessageNotes } from "./council-message-notes";
import {
  workflowMessageAllowed,
  workflowMessageSender,
} from "./council-workflow-messaging";
export interface CouncilWorkflowRecipientPort {
  resolve(projectId: string, teamId: string): Promise<MessageRecipient | null>;
  dispatch(
    projectId: string,
    sourcePath: string,
    submissionKey: string,
  ): Promise<void>;
}
/** Live recipient resolution and note delivery do not own execution state. */
export class CouncilMessageRouting implements JournalMessageDelivery {
  readonly allowed: JournalMessageDelivery["allowed"];
  readonly deliver: JournalMessageDelivery["deliver"];
  constructor(
    plugin: Plugin,
    kernel: ExecutionKernel,
    catalogue: CouncilCatalogueActions,
    protect: (paths: string[]) => Promise<void>,
    submit: (
      target: CouncilTarget,
      path: string,
      key: string,
    ) => Promise<ExecutionRun>,
    workflow?: CouncilWorkflowRecipientPort,
  ) {
    const notes = new CouncilMessageNotes(
      plugin.app.vault,
      protect,
      () => kernel.snapshot().runs,
    );
    const allowed = async (message: TeamMessage): Promise<boolean> => {
      const root = kernel
        .snapshot()
        .messaging?.roots.find((root) => root.id === message.rootId);
      if (
        kernel.snapshot().runs.find((run) => run.id === message.runId)
          ?.state === "cancelled"
      )
        return false;
      if (
        !root ||
        root.stopped ||
        (root.deadline !== undefined && Date.now() >= Date.parse(root.deadline))
      )
        return false;
      const snapshot = await catalogue.list();
      const team = snapshot.valid.find(
        (item) => item.definition.id === message.teamId,
      )?.definition;
      const target = snapshot.valid.find(
        (item) => item.definition.id === message.recipientId,
      )?.definition;
      if (
        !team ||
        team.schema !== "team/v1" ||
        !team.enabled ||
        team.projectId !== message.projectId
      )
        return false;
      if (message.senderId === "operator")
        return (
          message.purpose === "information" && message.recipientId === team.id
        );
      const workflowTarget = !target
        ? await workflow?.resolve(message.recipientId, message.teamId)
        : null;
      if (
        workflowTarget &&
        (workflowTarget.projectId !== message.projectId ||
          workflowTarget.teamId !== message.teamId)
      )
        return false;
      if (!target?.enabled && !workflowTarget) return false;
      const origin = kernel
        .snapshot()
        .runs.find((run) => run.id === message.runId);
      if (
        origin &&
        isWorkflowV2Run(origin) &&
        message.senderId === workflowMessageSender(origin)
      )
        return workflowMessageAllowed(message, origin, snapshot);
      const sender = snapshot.valid.find(
        (item) => item.definition.id === message.senderId,
      )?.definition;
      return Boolean(
        sender?.schema === "agent/v1" &&
        sender.enabled &&
        sender.requestedCapabilities.messaging &&
        team.members.includes(sender.id) &&
        team.allowedRecipients.includes(message.recipientId) &&
        (workflowTarget ||
          (target?.schema === "agent/v1"
            ? team.members.includes(target.id)
            : target &&
              target.projectId === message.projectId &&
              (target.schema !== "council/v1" || target.teamId === team.id))),
      );
    };
    this.allowed = allowed;
    this.deliver = async (entry: MessageOutboxEntry) => {
      if (!(await allowed(entry.message)))
        throw new Error("Message permission was revoked before delivery.");
      const path = await notes.deliver(entry.message);
      if (!entry.message.startsRun) return;
      const snapshot = await catalogue.list();
      const target = snapshot.valid.find(
        (item) => item.definition.id === entry.message.recipientId,
      )?.definition;
      if (!target && workflow) {
        const recipient = await workflow.resolve(
          entry.message.recipientId,
          entry.message.teamId,
        );
        if (
          !recipient ||
          recipient.expectedInvocations > entry.message.reservedInvocations ||
          !(await allowed(entry.message))
        )
          throw new Error(
            "The workflow destination changed or exceeds its reserved invocation allowance.",
          );
        await workflow.dispatch(
          recipient.projectId,
          path,
          `message:${entry.message.id}`,
        );
        return;
      }
      if (
        !target ||
        (target.schema !== "agent/v1" && target.schema !== "council/v1")
      )
        throw new Error("The request destination is unavailable.");
      const child = resolveCouncilPlan(snapshot, {
        kind: target.schema === "agent/v1" ? "agent" : "council",
        id: target.id,
        teamId: entry.message.teamId,
      });
      if (child.invocations.length > entry.message.reservedInvocations)
        throw new Error(
          "The recipient expansion exceeds its reserved root invocation allowance. Inspect the changed definition.",
        );
      if (!(await allowed(entry.message)))
        throw new Error(
          "The root conversation stopped or permission was revoked before dispatch.",
        );
      await submit(
        {
          kind: target.schema === "agent/v1" ? "agent" : "council",
          id: target.id,
          teamId: entry.message.teamId,
        },
        path,
        `message:${entry.message.id}`,
      );
    };
  }
}
