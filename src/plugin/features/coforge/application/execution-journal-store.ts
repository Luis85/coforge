import {
  emptyExecutionJournal,
  executionAdmissionCheck,
  executionJournalCheck,
  type ExecutionAdmission,
  type ExecutionJournal,
  type ExecutionRun,
} from "../domain/execution-run";
import type { ExecutionKernelHost } from "./execution-ports";
import { cancelledExecutionLineage } from "../domain/execution-lineage";

/** Sole in-memory authority: every service commits through this serialized durable journal. */
export class ExecutionJournalStore {
  private journal = emptyExecutionJournal();
  private loaded = false;
  private faulted = false;
  private readonly listeners = new Set<(journal: ExecutionJournal) => void>();
  private tail: Promise<void> = Promise.resolve();
  constructor(
    private readonly host: Pick<ExecutionKernelHost, "journal" | "now">,
    private readonly onFault: () => void,
  ) {}
  get isFaulted(): boolean {
    return this.faulted;
  }
  clearListeners(): void {
    this.listeners.clear();
  }
  snapshot(): ExecutionJournal {
    return structuredClone(this.journal);
  }
  subscribe(listener: (journal: ExecutionJournal) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot());
      } catch {
        /* Observers cannot alter committed execution. */
      }
    }
  }
  assertLoaded(): void {
    if (!this.loaded || this.faulted)
      throw new Error(
        "Reload the execution journal before continuing after a storage failure.",
      );
  }
  async mutate<T>(change: (next: ExecutionJournal) => T): Promise<T> {
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      this.assertLoaded();
      const next = structuredClone(this.journal);
      const result = change(next);
      next.revision++;
      executionJournalCheck(next);
      try {
        await this.host.journal.save(next, this.journal.revision);
      } catch (error) {
        this.faulted = true;
        this.onFault();
        throw error;
      }
      this.journal = next;
      this.notify();
      return result;
    } finally {
      release();
    }
  }
  async load(): Promise<void> {
    this.loaded = false;
    this.journal = executionJournalCheck(await this.host.journal.load());
    this.loaded = true;
    this.faulted = false;
    if (
      this.journal.runs.some(
        (run) =>
          run.timing?.active || run.timing?.parallel?.length ||
          run.attempts.some((attempt) => attempt.status === "dispatching"),
      )
    )
      await this.mutate((next) => {
        for (const run of next.runs) {
          if (run.timing) { delete run.timing.active; delete run.timing.parallel; }
          for (const attempt of run.attempts)
            if (attempt.status === "dispatching") {
              attempt.status = "unknown";
              attempt.error =
                "The provider outcome is unknown. Inspect the original session before explicitly retrying.";
              if (run.state !== "cancelled") run.state = "attention";
              run.reason = attempt.error;
              run.updatedAt = this.host.now();
            }
        }
      });
    this.notify();
  }
  async admit(value: ExecutionAdmission): Promise<ExecutionRun> {
    this.assertLoaded();
    const input = executionAdmissionCheck(value);
    const duplicate = this.journal.submissions.find(
      (item) => item.key === input.submissionKey,
    );
    if (duplicate) {
      const run = this.journal.runs.find((item) => item.id === duplicate.runId);
      if (!run)
        throw new Error(
          "This submission was already processed and retained as a replay tombstone.",
        );
      return structuredClone(run);
    }
    await this.mutate((next) => {
      if (next.submissions.some((item) => item.key === input.submissionKey))
        return;
      if (cancelledExecutionLineage(next, input))
        throw new Error(
          "The originating conversation branch was cancelled; no descendant was admitted.",
        );
      if (next.runs.some((item) => item.id === input.id))
        throw new Error("The execution identity is already in use.");
      if (
        next.runs.filter(
          (item) => !["completed", "cancelled"].includes(item.state),
        ).length >= 50
      )
        throw new Error(
          "The execution queue is full; the submission remains deferred.",
        );
      const at = this.host.now();
      next.runs.push({
        ...input,
        cursor: 0,
        state: "queued",
        attempts: [],
        artifacts: [],
        createdAt: at,
        updatedAt: at,
      });
      next.submissions.push({ key: input.submissionKey, runId: input.id });
    });
    return structuredClone(
      this.journal.runs.find(
        (run) => run.submissionKey === input.submissionKey,
      )!,
    );
  }
  find(id: string): ExecutionRun {
    const run = this.journal.runs.find((item) => item.id === id);
    if (!run) throw new Error("Execution run not found.");
    return run;
  }
}
