import type { ExecutionJournalPort } from "../../features/coforge/application/execution-kernel";
import {
  emptyExecutionJournal,
  EXECUTION_JOURNAL_BYTES,
  executionJournalCheck,
  type ExecutionJournal,
} from "../../features/coforge/domain/execution-run";
import { contextEventId } from "../../features/coforge/domain/integrity";
import {
  oneOf,
  record,
  shape,
  text,
} from "../../features/coforge/domain/check";

/** A plugin-private adapter directory, never a note or public export directory. */
export interface ExecutionJournalFiles {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, value: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}
function encode(journal: ExecutionJournal): string {
  // Both callers already hold checked records. Embed valid serialized JSON once without double encoding.
  const payload = JSON.stringify(journal);
  return `{"format":"coforge-execution-envelope/v2","checksum":"${contextEventId(payload)}","payload":${payload}}`;
}
function decode(value: string): ExecutionJournal {
  // Legacy payloads were JSON encoded twice: each escaped byte can double once more in the envelope.
  if (value.length > 2 * EXECUTION_JOURNAL_BYTES + 4096)
    throw new Error(
      "The retained execution journal exceeds its storage envelope.",
    );
  const input: unknown = JSON.parse(value);
  if (typeof record(input).payload !== "string") {
    const serializedPayload = JSON.stringify(record(input).payload);
    const envelope = shape(
      {
        format: oneOf(["coforge-execution-envelope/v2"] as const),
        checksum: text({ min: 1, max: 200 }),
        payload: executionJournalCheck,
      },
      { strict: true },
    )(input);
    if (contextEventId(serializedPayload) !== envelope.checksum)
      throw new Error(
        "The private execution journal is damaged. Preserve its files before recovery.",
      );
    return envelope.payload;
  }
  const envelope = shape(
    {
      checksum: text({ min: 1, max: 200 }),
      payload: text({ max: EXECUTION_JOURNAL_BYTES }),
    },
    { strict: true },
  )(input);
  if (contextEventId(envelope.payload) !== envelope.checksum)
    throw new Error(
      "The private execution journal is damaged. Preserve its files before recovery.",
    );
  return executionJournalCheck(JSON.parse(envelope.payload));
}

/** Temp and backup records survive interrupted replacement. Checksums detect damage, never confer authority. */
export class FileExecutionJournal implements ExecutionJournalPort {
  private readonly main: string;
  private cached?: { encoded: string; journal: ExecutionJournal };
  private checkedRecord(encoded: string): ExecutionJournal {
    if (this.cached?.encoded === encoded)
      return structuredClone(this.cached.journal);
    const journal = decode(encoded);
    if (!this.cached || journal.revision >= this.cached.journal.revision)
      this.cached = { encoded, journal: structuredClone(journal) };
    return journal;
  }
  constructor(
    private readonly files: ExecutionJournalFiles,
    directory: string,
  ) {
    if (
      !directory ||
      /(^|\/)\.\.?($|\/)/.test(directory) ||
      /[\\:\r\n]/.test(directory) ||
      directory.startsWith("/")
    )
      throw new Error(
        "The execution journal requires a normalized vault-relative private directory.",
      );
    this.main = `${directory}/coforge-execution-v2.json`;
  }
  private async records(): Promise<
    { path: string; journal: ExecutionJournal }[]
  > {
    const result: { path: string; journal: ExecutionJournal }[] = [];
    for (const path of [this.main, `${this.main}.tmp`, `${this.main}.bak`])
      if (await this.files.exists(path)) {
        try {
          result.push({
            path,
            journal: this.checkedRecord(await this.files.read(path)),
          });
        } catch {
          throw new Error(
            "Execution journal recovery requires attention: a retained record is damaged. No older record was replayed.",
          );
        }
      }
    result.sort(
      (left, right) => right.journal.revision - left.journal.revision,
    );
    const head = result[0];
    if (
      head &&
      result.some(
        (item) =>
          item.journal.revision === head.journal.revision &&
          JSON.stringify(item.journal) !== JSON.stringify(head.journal),
      )
    )
      throw new Error(
        "Execution journal records conflict at the same revision. Preserve them for inspection.",
      );
    return result;
  }
  async load(): Promise<ExecutionJournal> {
    return (await this.records())[0]?.journal ?? emptyExecutionJournal();
  }
  async save(next: ExecutionJournal, previousRevision: number): Promise<void> {
    const checked = executionJournalCheck(next);
    if (checked.revision !== previousRevision + 1)
      throw new Error("The execution journal revision must advance once.");
    const records = await this.records();
    if ((records[0]?.journal.revision ?? 0) !== previousRevision)
      throw new Error(
        "The execution journal changed on disk. Reload before dispatching.",
      );
    const encoded = encode(checked);
    this.cached = { encoded, journal: checked };
    // Promote any recovered temp record before reusing its name for the next durable intent.
    const recovered = records[0];
    if (recovered && recovered.path !== this.main)
      await this.files.write(this.main, encode(recovered.journal));
    await this.files.write(`${this.main}.tmp`, encoded);
    if (await this.files.exists(this.main)) {
      if (await this.files.exists(`${this.main}.bak`))
        await this.files.remove(`${this.main}.bak`);
      await this.files.rename(this.main, `${this.main}.bak`);
    }
    await this.files.rename(`${this.main}.tmp`, this.main);
  }
}
