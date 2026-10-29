// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilIntakeRuntime } from "../../../infrastructure/coforge/council-intake-runtime";
import { CouncilSourceNotes } from "../../../infrastructure/coforge/council-source-notes";
import type { CouncilPreferences } from "../../../features/coforge/application/council-ports";
import type { IntakeState } from "../../../features/coforge/application/intake-service";
import { SCHEDULED_TASK_FOLDER } from "../../../features/coforge/domain/scheduled-task";
import { COUNCIL_TASK_FOLDER } from "../../../features/coforge/domain/council-task";
import { nodeTimers } from "./memory-storage";

function fixture(path = SCHEDULED_TASK_FOLDER) {
  const app = new App(); const notePath = `${path}/Existing.md`; const original = "# A managed task\nPreserve exact human bytes.\n";
  const kit = createTestApp({ app, files: { [notePath]: original } });
  const sources = new CouncilSourceNotes(app.vault, () => []); const identify = vi.spyOn(sources, "identify");
  const binding = { id: "legacy", path, projectId: "project", teamId: "team", target: { kind: "agent" as const, id: "agent" }, enabled: true, recursive: true, submit: "after-stable" as const, settleMs: 0 };
  const preferences: CouncilPreferences = { format: "coforge-council-settings/v1", revision: 1, executorId: "desktop", bindings: [binding] };
  let state: IntakeState = { activations: [{ bindingId: binding.id, activatedAt: 0, baselineSourceIds: [] }], observations: [] };
  const policy = { publicFolder: "CoForge/Public", configFolder: app.vault.configDir, definitionFolders: ["CoForge/Agents"], outputFolders: [SCHEDULED_TASK_FOLDER, COUNCIL_TASK_FOLDER, "CoForge/Tests", "CoForge/Messages"] };
  const admit = vi.fn(async () => "admitted" as const); const assertExecutor = vi.fn(async () => {}); const errors: string[] = [];
  const runtime = new CouncilIntakeRuntime(app.vault, sources, {
    intake: async () => structuredClone(state), saveIntake: async next => { state = structuredClone(next); },
  }, nodeTimers(), {
    enabled: () => true, preferences: () => preferences, folderPolicy: () => policy,
    assertExecutor, admit, publish() {}, error: message => { errors.push(message); },
  }, app.metadataCache);
  return { app, kit, runtime, identify, admit, assertExecutor, preferences, binding, policy, errors, notePath, original };
}

it("holds legacy managed-folder startup and metadata arrivals without identifying or admitting, then permits a repaired ordinary inbox", async () => {
  vi.useFakeTimers(); const f = fixture(); const savedPreferences = JSON.stringify(f.preferences);
  try {
    await f.runtime.watcher.start(f.preferences.bindings);
    expect(f.identify).not.toHaveBeenCalled(); expect(f.admit).not.toHaveBeenCalled();
    expect(f.kit.read(f.notePath)).toBe(f.original);
    expect(f.runtime.results()).toContainEqual(expect.objectContaining({ path: f.notePath, status: "attention", reason: expect.stringMatching(/folder|scope|inbox/i) }));
    const file = f.app.vault.getFileByPath(f.notePath)!;
    await f.app.vault.modify(file, f.original + "Metadata arrived later.\n");
    await vi.advanceTimersByTimeAsync(100);
    expect(f.identify).not.toHaveBeenCalled(); expect(f.admit).not.toHaveBeenCalled();
    expect(JSON.stringify(f.preferences)).toBe(savedPreferences);
    f.binding.path = "Private/Inbox";
    await f.app.vault.createFolder("Private/Inbox");
    await f.app.vault.create("Private/Inbox/New.md", "A legitimate ordinary task.");
    await f.runtime.watcher.updateBindings(f.preferences.bindings);
    expect(f.identify).toHaveBeenCalledTimes(1); expect(f.admit).toHaveBeenCalledTimes(1);
    expect(f.runtime.results()).toContainEqual(expect.objectContaining({ path: "Private/Inbox/New.md", status: "admitted" }));
  } finally { f.runtime.watcher.dispose(); vi.useRealTimers(); }
});

it("rechecks current policy after executor validation before automatic admission", async () => {
  const f = fixture("Private/Inbox"); let checks = 0;
  f.assertExecutor.mockImplementation(async () => { checks++; if (checks === 3) f.policy.outputFolders.push("Private/Inbox"); });
  try {
    await f.runtime.watcher.start(f.preferences.bindings);
    expect(f.identify).toHaveBeenCalledTimes(1);
    expect(f.admit).not.toHaveBeenCalled();
    expect(f.runtime.results()).toContainEqual(expect.objectContaining({ path: f.notePath, status: "attention" }));
  } finally { f.runtime.watcher.dispose(); }
});
