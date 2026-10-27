import type { StreamHistoryPort } from "../../features/coforge/application/stream-metrics-ports";
import {
  streamHistoryCheck,
  streamHistoryId,
  streamSummaryCheck,
} from "../../features/coforge/domain/stream-history-check";
import { summarizeStream, type StreamHistory, type StreamSummary } from "../../features/coforge/domain/stream-metrics";
import { list, nullable, shape } from "../../features/coforge/domain/check";
import { readJson, writeJson, type JsonFiles } from "./atomic-json";

const FOLDER = "CoForge/Streams";
const INDEX = FOLDER + "/.index.json";
const indexCheck = shape({ activeId: nullable(streamHistoryId), streams: list(streamSummaryCheck) });
const pathFor = (id: string) => `${FOLDER}/${streamHistoryId(id)}.json`;
/** Canonical private, per-stream JSON; the lightweight index never contains raw samples or credentials. */
export class StreamHistoryStorage implements StreamHistoryPort {
  constructor(private readonly files: JsonFiles) {}
  private checked(input: unknown, id: string): StreamHistory {
    const value = streamHistoryCheck(input);
    if (
      value.id !== id ||
      value.samples.some(
        (sample, index) =>
          sample.channelId !== value.channelId ||
          (index > 0 &&
            (sample.minute <= value.samples[index - 1]!.minute ||
              Date.parse(sample.at) < Date.parse(value.samples[index - 1]!.at))),
      )
    )
      throw new Error(
        "Stream history identity or sample order is invalid. Restore its last complete file before recording.",
      );
    return value;
  }
  private async ensureFolder(): Promise<void> {
    for (const folder of ["CoForge", FOLDER]) {
      if (await this.files.exists(folder)) continue;
      try {
        await this.files.mkdir(folder);
      } catch {
        if (!(await this.files.exists(folder))) throw new Error("The stream history folder could not be created.");
      }
    }
  }
  private async index() {
    return (await readJson(this.files, INDEX, indexCheck)) ?? { activeId: null, streams: [] };
  }
  read(id: string): Promise<StreamHistory | null> {
    return readJson(this.files, pathFor(id), (input) => this.checked(input, id));
  }
  async active(): Promise<StreamHistory | null> {
    const index = await this.index();
    if (index.activeId) {
      const active = await this.read(index.activeId);
      if (active && !active.endedAt) return active;
    }
    if (!(await this.files.exists(FOLDER))) return null;
    const indexed = new Set(index.streams.map((stream) => pathFor(stream.id)));
    // Recover a first snapshot whose file committed before an interrupted index write.
    const orphanFiles = (await this.files.list(FOLDER)).files.filter(
      (path) => /\/[^/.]+\.json$/.test(path) && !indexed.has(path),
    );
    for (const path of orphanFiles.sort().reverse()) {
      const value = await readJson(this.files, path, streamHistoryCheck);
      if (value && pathFor(value.id) !== path)
        throw new Error("A stream history filename does not match its identity.");
      if (value && !value.endedAt) return value;
    }
    return null;
  }
  async save(input: StreamHistory): Promise<void> {
    const parsed = this.checked(input, input.id);
    const history = { ...parsed, summary: summarizeStream(parsed) };
    await this.ensureFolder();
    await writeJson(this.files, pathFor(history.id), history, (input) => this.checked(input, history.id));
    const index = await this.index();
    const summary = summarizeStream(history);
    index.streams = [summary, ...index.streams.filter((stream) => stream.id !== history.id)];
    index.activeId = history.endedAt ? (index.activeId === history.id ? null : index.activeId) : history.id;
    await writeJson(this.files, INDEX, index, indexCheck);
  }
  async list(): Promise<StreamSummary[]> {
    return (await this.index()).streams;
  }
}
