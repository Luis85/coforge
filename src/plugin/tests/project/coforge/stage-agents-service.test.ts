import { afterEach, describe, expect, it } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import { createSeed } from "../../../features/coforge/domain/seed";
import { MemoryStorage, nodeTimers } from "./memory-storage";
import type { StageRunner } from "../../../features/coforge/application/ports";
const services: StudioService[] = [];
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.stop()));
});
const runner: StageRunner = async () => {
  throw new Error("A model must not run during configuration.");
};
async function setup(claudeStage = false) {
  const initial = createSeed();
  if (claudeStage)
    initial.settings.stageAgents = { screen: { provider: "claude" } };
  const storage = new MemoryStorage(initial);
  let probes = 0;
  const studio = new StudioService(storage, {
    runners: { demo: runner, claude: runner },
    timers: nodeTimers(),
    probeRuntime: async () => {
      probes++;
      return {
        cliAvailable: true,
        projectPath: null,
        allowImplementation: false,
      };
    },
  });
  services.push(studio);
  await studio.start();
  return { studio, storage, probes: () => probes };
}
describe("project stage configuration service", () => {
  it("probes Claude when an effective stage uses it even if the default is simulation", async () => {
    const { studio, probes } = await setup(true);
    expect(probes()).toBe(1);
    expect(studio.state().runtime.cliAvailable).toBe(true);
    await studio.updateSettings({
      stageAgents: { plan: { provider: "claude", model: "plan-model" } },
    });
    expect(probes()).toBe(2);
    expect(studio.state().population?.operations.at(-1)?.code).toBe(
      "project-stage-agents-updated",
    );
  });
  it("rejects default and step agent edits during queued work while preserving pause/cancel controls", async () => {
    const { studio, storage } = await setup();
    const id = studio.state().activeProjectId!;
    await studio.store.transaction((state) => {
      state.jobs.push({
        id: "held",
        ideaId: "CF-107",
        projectId: id,
        stage: "screen",
        status: "queued",
        provider: "demo",
        startedAt: new Date().toISOString(),
        logs: [],
      });
    });
    const before = storage.saves;
    const settings = studio.state().settings;
    for (const patch of [
      { provider: "claude" },
      { model: "other-model" },
      { stageAgents: { screen: { provider: "claude" } } },
    ])
      await expect(studio.updateSettings(patch)).rejects.toThrow("queued runs");
    await expect(
      studio.updateProject({
        stageAgents: { screen: { model: "other-model" } },
      }),
    ).rejects.toThrow("queued runs");
    expect(storage.saves).toBe(before);
    expect(studio.state().settings).toEqual(settings);
    await studio.updateSettings({
      paused: true,
      automation: { screen: false },
    });
    expect(studio.state().settings.automation.screen).toBe(false);
    await studio.cancel("held");
    expect(studio.state().jobs.at(-1)?.status).toBe("cancelled");
  });
  it("keeps a failed configuration write out of canonical state and does not probe it", async () => {
    const { studio, storage, probes } = await setup();
    const before = studio.state().settings;
    storage.failNextSave = true;
    await expect(
      studio.updateSettings({
        stageAgents: { score: { provider: "claude", model: "score-model" } },
      }),
    ).rejects.toThrow("Disk full");
    expect(studio.state().settings).toEqual(before);
    expect(probes()).toBe(0);
  });
});
