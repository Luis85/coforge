import { describe, expect, it } from "vitest";
import { StreamHistoryStorage } from "../../../infrastructure/coforge/stream-history-storage";
import type { JsonFiles } from "../../../infrastructure/coforge/atomic-json";
import type { StreamHistory } from "../../../features/coforge/domain/stream-metrics";

class Files implements JsonFiles {
  data = new Map<string, string>();
  folders = new Set<string>();
  failIndex = false;
  failReplacement = false;
  async exists(path: string) {
    return this.data.has(path) || this.folders.has(path);
  }
  async read(path: string) {
    const value = this.data.get(path);
    if (value === undefined) throw new Error("Missing");
    return value;
  }
  async write(path: string, value: string) {
    this.data.set(path, value);
  }
  async rename(from: string, to: string) {
    if (
      from.endsWith(".tmp") &&
      ((this.failIndex && to.endsWith("/.index.json")) || (this.failReplacement && to.endsWith("/twitch-123-1.json")))
    )
      throw new Error("Cannot replace");
    if (this.data.has(to)) throw new Error("Already exists");
    const value = await this.read(from);
    this.data.set(to, value);
    this.data.delete(from);
  }
  async remove(path: string) {
    this.data.delete(path);
  }
  async mkdir(path: string) {
    this.folders.add(path);
  }
  async list(path: string) {
    return { files: [...this.data.keys()].filter((key) => key.startsWith(path + "/")), folders: [] };
  }
}
const history = (): StreamHistory => ({
  schemaVersion: 1,
  id: "twitch-123-1",
  channelId: "123",
  startedAt: "2026-10-27T10:00:00Z",
  twitchStreamId: "1",
  obsStartedAt: null,
  endedAt: null,
  endReason: null,
  baselineCounters: {},
  samples: [],
});
const persisted = (value: StreamHistory) => ({
  ...value,
  summary: {
    id: value.id,
    channelId: value.channelId,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    samples: 0,
    lastSampleAt: value.startedAt,
    peakObservedViewers: null,
    meanObservedViewers: null,
    followerNetChange: null,
    subscriberNetChange: null,
  },
});
describe("private stream JSON storage", () => {
  it("refuses a filename/identity mismatch instead of writing into another stream", async () => {
    const files = new Files();
    const storage = new StreamHistoryStorage(files);
    await storage.save(history());
    const path = "CoForge/Streams/twitch-123-1.json";
    const changed = JSON.stringify({ ...history(), id: "another-stream" });
    files.data.set(path, changed);
    await expect(storage.read("twitch-123-1")).rejects.toThrow("invalid");
    await expect(storage.save(history())).rejects.toThrow("identity");
    expect(await files.read(path)).toBe(changed);
  });
  it("round-trips one object per stream and rejects path traversal", async () => {
    const files = new Files();
    const storage = new StreamHistoryStorage(files);
    const value = history();
    await storage.save(value);
    expect(await storage.active()).toEqual(persisted(value));
    expect(await storage.list()).toHaveLength(1);
    expect(JSON.parse(await files.read("CoForge/Streams/twitch-123-1.json"))).toEqual(persisted(value));
    expect(() => storage.read("../outside")).toThrow();
  });
  it("preserves the last complete object when replacement fails", async () => {
    const files = new Files();
    const storage = new StreamHistoryStorage(files);
    const value = history();
    await storage.save(value);
    files.failReplacement = true;
    await expect(storage.save({ ...value, endedAt: "2026-10-27T11:00:00Z", endReason: "offline" })).rejects.toThrow(
      "retained",
    );
    expect(await storage.read(value.id)).toEqual(persisted(value));
  });
  it("recovers a first stream file when its index write was interrupted", async () => {
    const files = new Files();
    files.failIndex = true;
    const storage = new StreamHistoryStorage(files);
    const value = history();
    await expect(storage.save(value)).rejects.toThrow();
    expect(await storage.active()).toEqual(persisted(value));
    files.failIndex = false;
    await storage.save(value);
    expect(await storage.list()).toHaveLength(1);
    value.endedAt = "2026-10-27T11:00:00Z";
    value.endReason = "offline";
    await storage.save(value);
    expect(await storage.active()).toBeNull();
  });
});
