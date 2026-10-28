import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilModule } from "../../../infrastructure/coforge/council-module";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { StudioService } from "../../../features/coforge/application/studio";
import { createSeed } from "../../../features/coforge/domain/seed";
import { MemoryStorage, nodeTimers } from "./memory-storage";
export async function councilControlsFixture(executor = true) {
  const app = new App();
  const kit = createTestApp({
    app,
    layoutReady: true,
    files: { "Private/Proposal.md": "The original proposal.\n" },
  });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const timers = nodeTimers();
  const runner = async () => ({ markdown: "unused legacy runner" });
  const studio = new StudioService(new MemoryStorage(createSeed()), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.store.init();
  const module = new CouncilModule(
    plugin,
    studio,
    timers,
    new InvocationGate(),
  );
  await module.start();
  if (executor) await module.actions.designateExecutor();
  const projectId = studio.state().activeProjectId!;
  await module.actions.catalogue.save({
    schema: "agent/v1",
    id: "agent",
    name: "Reviewer",
    enabled: true,
    role: "Reviewer",
    instructions: "Inspect the captured proposal.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  });
  await module.actions.catalogue.save({
    schema: "team/v1",
    id: "team",
    name: "Team",
    enabled: true,
    projectId,
    members: ["agent"],
    pinnedContext: [],
    recentMessages: 10,
    allowedRecipients: [],
  });
  const target = { kind: "agent" as const, id: "agent", teamId: "team" };
  return {
    app,
    kit,
    module,
    studio,
    target,
    projectId,
    async dispose() {
      await module.dispose();
      await studio.stop();
    },
  };
}
