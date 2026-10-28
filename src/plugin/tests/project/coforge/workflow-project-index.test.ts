// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultWorkflowV2 } from "../../../infrastructure/coforge/vault-workflow-v2";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { StudioService } from "../../../features/coforge/application/studio";
import { nodeTimers } from "./memory-storage";

it("uses the canonical project index for repeated workflow loads while verifying current note identity", async () => {
  const app = new App();
  createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const storage = new VaultStudioStorage(plugin);
  const unused = async () => {
    throw new Error("Unexpected AI invocation.");
  };
  const studio = new StudioService(storage, {
    timers: nodeTimers(),
    runners: { demo: unused, claude: unused },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  try {
    await studio.start();
    const project = await studio.createProject({
      projectName: "Indexed project",
      projectBrief: "Private workflow owner.",
      projectPath: "/synthetic/indexed",
    });
    const resolver = vi.fn((id: string) => storage.projectFile(id));
    const notes = new VaultWorkflowV2(app.vault, resolver);
    const enumerate = vi.spyOn(app.vault, "getMarkdownFiles");
    expect((await notes.load(project.id)).definition).toBeNull();
    expect((await notes.load(project.id)).definition).toBeNull();
    expect(enumerate).not.toHaveBeenCalled();
    expect(resolver).toHaveBeenCalledTimes(2);
    const file = storage.projectFile(project.id)!;
    await app.vault.process(file, (text) =>
      text.replace(project.id, "CFP-99999"),
    );
    await expect(notes.load(project.id)).rejects.toThrow("identity");
    expect(enumerate).not.toHaveBeenCalled();
    enumerate.mockRestore();
  } finally {
    await studio.stop();
  }
});
