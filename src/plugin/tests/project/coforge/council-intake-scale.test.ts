import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilSourceNotes } from "../../../infrastructure/coforge/council-source-notes";
import { CouncilInboxWatcher } from "../../../infrastructure/coforge/council-inbox-watcher";
import {
  IntakeService,
  type IntakeState,
} from "../../../features/coforge/application/intake-service";
import { contextEventId } from "../../../features/coforge/domain/integrity";
import { nodeTimers } from "./memory-storage";

it("routes one incremental arrival in a 10,000-note vault without rereading unrelated notes or rescanning the vault", async () => {
  vi.useFakeTimers();
  const files: Record<string, string> = {};
  for (let index = 0; index < 10000; index++)
    files[`${index < 500 ? "Private/Inbox" : "Unrelated"}/Note-${index}.md`] =
      `# Note ${index}\nHuman text.`;
  const app = new App();
  createTestApp({ app, files });
  const binding = {
    id: "inbox",
    path: "Private/Inbox",
    projectId: "project",
    teamId: "team",
    target: { kind: "agent" as const, id: "reviewer" },
    enabled: true,
    recursive: false,
    submit: "after-stable" as const,
    settleMs: 2000,
  };
  const baseline = Object.keys(files)
    .filter((path) => path.startsWith("Private/Inbox/"))
    .map((path) => ({ sourceId: contextEventId(path), generation: 0 }));
  let state: IntakeState = {
    activations: [
      {
        bindingId: binding.id,
        activatedAt: Date.now(),
        baselineSourceIds: baseline.map((item) => item.sourceId),
        baselineSubmissions: baseline,
      },
    ],
    observations: [],
  };
  const admissions: number[] = [];
  const intake = new IntakeService({
    load: async () => structuredClone(state),
    save: async (next) => {
      state = structuredClone(next);
    },
    identify: async (candidate) => ({
      ...candidate,
      sourceId: contextEventId(candidate.path),
    }),
    admit: async () => {
      admissions.push(Date.now());
      return "admitted";
    },
  });
  const sources = new CouncilSourceNotes(app.vault, () => []);
  const reads = vi.spyOn(sources, "read");
  const scans = vi.spyOn(app.vault, "getMarkdownFiles");
  const watcher = new CouncilInboxWatcher(
    app.vault,
    sources,
    {
      candidates: async (target, notes, now) => {
        await intake.reconcile(target, notes, now);
      },
      error: (message) => {
        throw new Error(message);
      },
    },
    nodeTimers(),
  );
  try {
    const starting = watcher.start([binding]);
    await vi.advanceTimersByTimeAsync(500);
    await starting;
    await vi.advanceTimersByTimeAsync(2200);
    expect(admissions).toEqual([]);
    expect(
      reads.mock.calls.every(([path]) => path.startsWith("Private/Inbox/")),
    ).toBe(true);
    reads.mockClear();
    scans.mockClear();
    const arrival = Date.now();
    await app.vault.create("Private/Inbox/New proposal.md", "# A new proposal");
    await vi.advanceTimersByTimeAsync(2200);
    expect(admissions).toHaveLength(1);
    expect(admissions[0]! - arrival).toBeGreaterThanOrEqual(2000);
    expect(admissions[0]! - arrival).toBeLessThanOrEqual(5000);
    expect(scans).not.toHaveBeenCalled();
    expect(
      reads.mock.calls.every(
        ([path]) => path === "Private/Inbox/New proposal.md",
      ),
    ).toBe(true);
    expect(reads.mock.calls.length).toBeLessThanOrEqual(2);
  } finally {
    watcher.dispose();
    vi.useRealTimers();
  }
}, 60000);
