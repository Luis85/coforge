import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
  type ExecutionMessagingState,
} from "../domain/execution-outbox";
import type { ExecutionJournal } from "../domain/execution-run";
import type {
  MessageAuthority,
  MessageOutboxEntry,
  TeamMessageDraft,
} from "../domain/team-messages";
import { TeamMessageService } from "./team-message-service";

interface MessagingJournal {
  snapshot(): ExecutionJournal;
  updateMessaging(
    work: (current: ExecutionMessagingState) => ExecutionMessagingState,
  ): Promise<void>;
}
export interface JournalMessageDelivery {
  allowed(entry: MessageOutboxEntry["message"]): Promise<boolean>;
  deliver(entry: MessageOutboxEntry): Promise<void>;
}
/** One facade over the execution journal; there is no second canonical message/budget store. */
export class JournalTeamMessages {
  private readonly service: TeamMessageService;
  constructor(
    private readonly journal: MessagingJournal,
    delivery: JournalMessageDelivery,
  ) {
    this.service = new TeamMessageService({
      commit: (entries, authority) =>
        journal.updateMessaging((current) =>
          commitExecutionMessages(
            current,
            authority,
            entries.map(({ message }) => ({
              purpose: message.purpose,
              recipientId: message.recipientId,
              body: message.body,
              ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            })),
          ),
        ),
      load: async () => this.messages(),
      save: (entry) =>
        journal.updateMessaging((current) => {
          const next = structuredClone(current);
          const index = next.outbox.findIndex(
            (item) => item.message.id === entry.message.id,
          );
          if (index < 0)
            throw new Error(
              "The delivery intent is missing. Reload the journal before repair.",
            );
          const saved = next.outbox[index]!;
        if (saved.status === "blocked" && entry.status !== "blocked")
          throw new Error("The conversation was stopped before delivery completed.");
          if (JSON.stringify(saved.message) !== JSON.stringify(entry.message))
            throw new Error(
              "Delivery cannot replace immutable message evidence.",
            );
          next.outbox[index] = structuredClone(entry);
          return next;
        }),
      allowed: delivery.allowed,
      deliver: delivery.deliver,
    });
  }
  messages(): MessageOutboxEntry[] {
    return structuredClone(this.journal.snapshot().messaging?.outbox ?? []);
  }
  enqueue(
    drafts: readonly TeamMessageDraft[],
    authority: MessageAuthority,
  ): Promise<void> {
    return this.service.enqueue(drafts, authority).then(() => undefined);
  }
  flush(): Promise<void> {
    return this.service.flush();
  }
  async stop(rootId: string): Promise<void> {
    await this.journal.updateMessaging((current) => {
      const next = structuredClone(current);
      const root = next.roots.find((item) => item.id === rootId);
      if (!root) throw new Error("The root conversation does not exist.");
      root.stopped = true;
      for (const entry of next.outbox.filter(
        (item) => item.message.rootId === rootId && item.status === "pending",
      )) {
        entry.status = "blocked";
        entry.reason =
          "The operator stopped future dispatch for this root conversation.";
      }
      return next;
    });
  }
  static empty(): ExecutionMessagingState {
    return emptyExecutionMessagingState();
  }
}
