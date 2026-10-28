import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { createTestApp } from "@test/obsidian";
import {
  App,
  Events,
  TFolder,
  TFile,
  type EventRef,
  type TAbstractFile,
} from "obsidian";
import { CouncilInboxWatcher } from "../../../infrastructure/coforge/council-inbox-watcher";
import { CouncilSourceNotes } from "../../../infrastructure/coforge/council-source-notes";
import type { IntakeCandidate } from "../../../features/coforge/domain/intake-bindings";

const binding = {
  id: "inbox",
  path: "Private/Inbox",
  projectId: "project",
  teamId: "team",
  target: { kind: "council" as const, id: "council" },
  enabled: true,
  recursive: false,
  submit: "after-stable" as const,
  settleMs: 2000,
};
describe("one contained inbox observation service", () => {
  it("handles folder-only rename/delete notifications and follows every indexed descendant", async () => {
    vi.useFakeTimers();
    try {
      const app = new App();
      createTestApp({ app });
      await app.vault.createFolder("Inbox/Original");
      const file = await app.vault.create(
        "Inbox/Original/Task.md",
        "Human task.",
      );
      const sources = new CouncilSourceNotes(app.vault, () => []);
      const identified = await sources.identify(await sources.read(file.path));
      const events = new Events();
      const batches: string[][] = [];
      function on(
        name: "rename",
        callback: (file: TAbstractFile, oldPath: string) => unknown,
      ): EventRef;
      function on(
        name: "create" | "modify" | "delete",
        callback: (file: TAbstractFile) => unknown,
      ): EventRef;
      function on(
        name: string,
        callback:
          | ((file: TAbstractFile) => unknown)
          | ((file: TAbstractFile, oldPath: string) => unknown),
      ): EventRef {
        return events.on(name, (...values: unknown[]) => {
          const [item, previous] = values;
          if (!(item instanceof TFile || item instanceof TFolder))
            throw new Error("Expected contained file event.");
          callback(item, typeof previous === "string" ? previous : "");
        });
      }
      const watcher = new CouncilInboxWatcher(
        {
          on,
          offref: events.offref.bind(events),
          getMarkdownFiles: () => app.vault.getMarkdownFiles(),
        },
        sources,
        {
          candidates: async (_binding, notes) => {
            batches.push(notes.map((note) => note.path));
          },
          error: () => undefined,
        },
        {
          setTimeout: (callback, ms) => Number(setTimeout(callback, ms)),
          clearTimeout: (id) => clearTimeout(id),
        },
      );
      const recursive = { ...binding, path: "Inbox", recursive: true };
      await watcher.start([recursive]);
      const folder = app.vault.getAbstractFileByPath("Inbox/Original");
      if (!(folder instanceof TFolder)) throw new Error("Expected folder.");
      await app.vault.rename(folder, "Inbox/Moved");
      events.trigger("rename", folder, "Inbox/Original");
      await vi.advanceTimersByTimeAsync(60);
      expect(sources.resolve(identified.sourceId)).toBe("Inbox/Moved/Task.md");
      expect(batches.at(-1)).toEqual(["Inbox/Moved/Task.md"]);
      await app.vault.delete(folder);
      events.trigger("delete", folder);
      expect(await watcher.preview(recursive)).toEqual([]);
      expect(() => sources.resolve(identified.sourceId)).toThrow();
      watcher.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
  it("filters paths before reads, batches repeated events, settles and disposes every listener/timer", async () => {
    vi.useFakeTimers();
    try {
      const app = new App();
      createTestApp({ app });
      await app.vault.createFolder("Private/Inbox");
      await app.vault.createFolder("Other");
      await app.vault.create("Other/Unrelated.md", "private unrelated");
      const sources = new CouncilSourceNotes(app.vault, () => []);
      const read = vi.spyOn(sources, "read");
      const batches: IntakeCandidate[][] = [];
      const watcher = new CouncilInboxWatcher(
        app.vault,
        sources,
        {
          candidates: async (_target, notes) => {
            batches.push(notes);
          },
          error: () => undefined,
        },
        {
          setTimeout: (callback, ms) => Number(setTimeout(callback, ms)),
          clearTimeout: (id) => clearTimeout(id),
        },
      );
      await watcher.start([binding]);
      expect(read.mock.calls).toEqual([]);
      const file = await app.vault.create("Private/Inbox/Task.md", "proposal");
      await app.vault.modify(file, "proposal saved");
      await app.vault.modify(file, "proposal settled");
      await vi.advanceTimersByTimeAsync(60);
      expect(
        batches.flat().some((note) => note.body === "proposal settled"),
      ).toBe(true);
      expect(
        read.mock.calls.every(([path]) => path.startsWith("Private/Inbox/")),
      ).toBe(true);
      const firstReads = read.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2100);
      expect(read.mock.calls.length).toBeGreaterThan(firstReads);
      watcher.dispose();
      const afterDispose = read.mock.calls.length;
      await app.vault.modify(file, "after dispose");
      await vi.advanceTimersByTimeAsync(5000);
      expect(read.mock.calls.length).toBe(afterDispose);
    } finally {
      vi.useRealTimers();
    }
  });
});
