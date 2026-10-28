// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp, hostInstance } from "@test/obsidian";
import { WorkflowWorkspaceStateStorage } from "../../../infrastructure/coforge/workflow-workspace-storage";
import type { WorkflowWorkspaceRecord } from "../../../features/coforge/application/workflow-workspace-ports";
function fixture() {
  const kit = createTestApp({ configDir: ".custom-host-config" });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(hostInstance(kit.app, App), {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const path = ".custom-host-config/plugins/coforge/coforge-workspaces.json";
  const record: WorkflowWorkspaceRecord = {
    id: "workspace-one",
    runId: "run-one",
    projectId: "CFP-001",
    projectPath: "/private/game",
    cwd: "/private/worktree",
    branch: "coforge/workflow-one",
    baseCommit: "a".repeat(40),
    phase: "attention",
    activeAttemptId: "attempt-one",
  };
  return {
    kit,
    plugin,
    path,
    record,
    storage: new WorkflowWorkspaceStateStorage(plugin),
  };
}
it("persists private workspace holds and retired recovery descriptors in the actual host config directory", async () => {
  const f = fixture();
  expect(await f.storage.load()).toEqual([]);
  await f.storage.save([f.record]);
  expect(JSON.parse(f.kit.read(f.path))).toEqual([f.record]);
  expect(await f.storage.load()).toEqual([f.record]);
  const retired = {
    ...f.record,
    phase: "retired" as const,
    reviewedAttemptId: f.record.activeAttemptId,
  };
  delete retired.activeAttemptId;
  await f.storage.save([retired]);
  expect(await new WorkflowWorkspaceStateStorage(f.plugin).load()).toEqual([
    retired,
  ]);
});
it("preserves corrupt journal bytes and rejects duplicate/incomplete metadata before writes", async () => {
  const f = fixture();
  await f.storage.save([f.record]);
  const original = f.kit.read(f.path);
  await expect(f.storage.save([f.record, f.record])).rejects.toThrow(
    "could not be saved",
  );
  await expect(
    f.storage.save([{ ...f.record, phase: "ready" }]),
  ).rejects.toThrow("could not be saved");
  expect(f.kit.read(f.path)).toBe(original);
  await f.plugin.app.vault.adapter.write(f.path, "{broken recovery evidence");
  await expect(f.storage.load()).rejects.toThrow("could not be loaded");
  expect(f.kit.read(f.path)).toBe("{broken recovery evidence");
});
