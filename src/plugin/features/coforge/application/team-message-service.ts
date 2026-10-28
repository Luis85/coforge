import {
  createTeamMessage,
  type MessageAuthority,
  type MessageOutboxEntry,
  type TeamMessage,
} from "../domain/team-messages";
export type { MessageOutboxEntry } from "../domain/team-messages";

export interface TeamMessagePorts {
  /** Atomic with the originating result, root budget reservation and ID deduplication. */
  commit(
    entries: readonly MessageOutboxEntry[],
    authority: MessageAuthority,
  ): Promise<void>;
  load(): Promise<MessageOutboxEntry[]>;
  save(entry: MessageOutboxEntry): Promise<void>;
  /** Rechecks operator revocation/root stop/recipient availability before each write or dispatch. */
  allowed(message: TeamMessage): Promise<boolean>;
  /** Idempotent by message.id across Markdown delivery and any request admission. Information/replies never admit a run. */
  deliver(entry: MessageOutboxEntry): Promise<void>;
}

/** Durable delivery, deliberately separate from provider execution and result publication. */
export class TeamMessageService {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly ports: TeamMessagePorts) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  enqueue(
    drafts: readonly unknown[],
    authority: MessageAuthority,
  ): Promise<TeamMessage[]> {
    return this.serial(async () => {
      if (drafts.length > 100)
        throw new Error("A result can propose at most 100 messages.");
      const current = structuredClone(authority);
      const entries: MessageOutboxEntry[] = [];
      for (const [index, draft] of drafts.entries()) {
        const message = createTeamMessage(draft, current, index);
        current.usage.messages++;
        current.usage.descendants += message.startsRun ? 1 : 0;
        current.usage.invocations += message.reservedInvocations;
        entries.push({ message, status: "pending", attempts: 0 });
      }
      // Validate the full batch before any write. The port rechecks/reserves shared root budgets atomically.
      await this.ports.commit(entries, authority);
      return entries.map((item) => structuredClone(item.message));
    });
  }
  flush(): Promise<void> {
    return this.serial(async () => {
      const entries = await this.ports.load();
      for (const entry of entries.filter((item) => item.status === "pending")) {
        if (!(await this.ports.allowed(entry.message))) {
          entry.status = "blocked";
          entry.reason =
            "Delivery is blocked by a stopped root, unavailable recipient or revoked permission.";
          await this.ports.save(entry);
          continue;
        }
        entry.attempts++;
        // Persist the delivery intent first. A failure after delivery remains safely replayable by stable ID.
        await this.ports.save(entry);
        try {
          await this.ports.deliver(entry);
        } catch {
          entry.reason =
            "Delivery is incomplete. Repair the destination and retry; the saved contribution remains available.";
          await this.ports.save(entry);
          continue;
        }
        entry.status = "delivered";
        delete entry.reason;
        await this.ports.save(entry);
      }
    });
  }
}
