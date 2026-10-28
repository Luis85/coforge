import { describe, expect, it } from "vitest";
import {
  FileExecutionJournal,
  type ExecutionJournalFiles,
} from "../../../infrastructure/coforge/execution-journal-storage";
import { emptyExecutionJournal } from "../../../features/coforge/domain/execution-run";
import { contextEventId } from "../../../features/coforge/domain/integrity";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";

function fixture() {
  const map = new Map<string, string>();
  let failRename = false;
  const files: ExecutionJournalFiles = {
    exists: async (path) => map.has(path),
    read: async (path) => {
      const value = map.get(path);
      if (value === undefined) throw new Error("missing");
      return value;
    },
    write: async (path, value) => {
      map.set(path, value);
    },
    remove: async (path) => {
      map.delete(path);
    },
    rename: async (from, to) => {
      if (failRename) throw new Error("interrupted");
      const value = map.get(from);
      if (value === undefined) throw new Error("missing");
      map.set(to, value);
      map.delete(from);
    },
  };
  return {
    journal: new FileExecutionJournal(files, ".obsidian/plugins/coforge"),
    map,
    failRename: (value: boolean) => {
      failRename = value;
    },
  };
}
function nearCapJournal() {
  const runs: ExecutionRun[] = Array.from({ length: 10 }, (_, index) => ({
    id: `run-${index}`,
    submissionKey: `key-${index}`,
    projectId: "project",
    teamId: "team",
    subject: {
      kind: "note",
      sourceId: `source-${index}`,
      revision: "r1",
      markdown: "\n".repeat(160000),
    },
    context: "\n".repeat(160000),
    definitionSnapshot: "\n".repeat(400000),
    invocations: [
      {
        id: "review",
        roundId: "review",
        agentId: "agent",
        agentRevision: "r1",
        provider: "demo",
        model: "demo",
        instructions: "Analyze",
        access: "none",
        inputRoundIds: [],
      },
    ],
    cursor: 0,
    state: "queued",
    attempts: [],
    artifacts: [],
    createdAt: "2026-10-28T12:00:00.000Z",
    updatedAt: "2026-10-28T12:00:00.000Z",
  }));
  return {
    ...emptyExecutionJournal(),
    revision: 1,
    runs,
    submissions: runs.map((run) => ({
      key: run.submissionKey,
      runId: run.id,
    })),
  };
}
describe("private execution journal replacement", () => {
  it("restores a durable temp record after interrupted rename and preserves revision continuity", async () => {
    const f = fixture();
    const one = { ...emptyExecutionJournal(), revision: 1 };
    await f.journal.save(one, 0);
    f.failRename(true);
    await expect(f.journal.save({ ...one, revision: 2 }, 1)).rejects.toThrow(
      "interrupted",
    );
    expect((await f.journal.load()).revision).toBe(2);
    f.failRename(false);
    await f.journal.save({ ...one, revision: 3 }, 2);
    expect((await f.journal.load()).revision).toBe(3);
  });
  it("detects corruption and never falls back to older potentially replayable intent", async () => {
    const f = fixture();
    await f.journal.save({ ...emptyExecutionJournal(), revision: 1 }, 0);
    await f.journal.save({ ...emptyExecutionJournal(), revision: 2 }, 1);
    f.map.set(
      ".obsidian/plugins/coforge/coforge-execution-v2.json",
      "{damaged",
    );
    await expect(f.journal.load()).rejects.toThrow("damaged");
    expect(f.map.size).toBe(2);
  });
  it("refuses competing writes without overwriting the current journal", async () => {
    const f = fixture();
    await f.journal.save({ ...emptyExecutionJournal(), revision: 1 }, 0);
    const returned = await f.journal.load();
    returned.revision = 99;
    expect((await f.journal.load()).revision).toBe(1);
    await expect(
      f.journal.save({ ...emptyExecutionJournal(), revision: 1 }, 0),
    ).rejects.toThrow("changed on disk");
    expect((await f.journal.load()).revision).toBe(1);
  });
  it("verifies object-envelope bytes before schema normalization so harmless validator property ordering remains compatible", async () => {
    const f = fixture();
    const payload = {
      revision: 1,
      runs: [],
      submissions: [],
      format: "coforge-execution/v2",
    };
    f.map.set(
      ".obsidian/plugins/coforge/coforge-execution-v2.json",
      JSON.stringify({
        format: "coforge-execution-envelope/v2",
        checksum: contextEventId(JSON.stringify(payload)),
        payload,
      }),
    );
    expect((await f.journal.load()).revision).toBe(1);
  });
  it("round-trips a valid near-cap journal containing heavily escaped content", async () => {
    const f = fixture();
    const journal = nearCapJournal();
    await f.journal.save(journal, 0);
    expect((await f.journal.load()).runs[9]?.definitionSnapshot).toHaveLength(
      400000,
    );
    const stored = f.map.get(
      ".obsidian/plugins/coforge/coforge-execution-v2.json",
    )!;
    expect(stored.length).toBeLessThan(17 * 1024 * 1024);
  });
  it("reads a near-cap legacy double-encoded journal without narrowing the persisted budget", async () => {
    const f = fixture();
    const journal = nearCapJournal();
    const legacyPayload = JSON.stringify(journal);
    f.map.set(
      ".obsidian/plugins/coforge/coforge-execution-v2.json",
      JSON.stringify({
        checksum: contextEventId(legacyPayload),
        payload: legacyPayload,
      }),
    );
    expect((await f.journal.load()).revision).toBe(1);
  });
});
