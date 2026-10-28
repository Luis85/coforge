import { afterEach, describe, expect, it } from "vitest";
import { WorkflowEngine } from "../../../features/coforge/application/engine";
import type {
  StageInput,
  StageRunner,
} from "../../../features/coforge/application/ports";
import {
  sampleIncrement,
  samplePlan,
} from "../../../features/coforge/domain/seed";
import { selectProjectState } from "../../../features/coforge/domain/projects";
import { seededStore, nodeTimers } from "./memory-storage";
const engines: WorkflowEngine[] = [];
afterEach(async () => {
  await Promise.all(engines.splice(0).map((engine) => engine.stop()));
});
function runner(seen: StageInput[]): StageRunner {
  return async (input) => {
    seen.push(input);
    if (input.stage === "screen")
      return {
        screening: {
          verdict: "clear",
          reason: "Fixture",
          signals: [],
          checkedAt: new Date().toISOString(),
          provider: input.settings.provider,
        },
      };
    if (input.stage === "score")
      return {
        rice: {
          reach: 10,
          impact: 1,
          confidence: 0.5,
          effort: 1,
          score: 5,
          rationale: "Fixture estimate",
        },
      };
    if (input.stage === "plan")
      return { plan: samplePlan(input.idea.title, new Date().toISOString()) };
    return {
      increment: sampleIncrement(input.idea.title, new Date().toISOString()),
    };
  };
}
describe("per-step provider dispatch", () => {
  it("runs a mixed-provider workflow through every step without bypassing final review", async () => {
    const { store } = await seededStore();
    const seen: StageInput[] = [];
    await store.transaction((state) => {
      state.settings = {
        ...state.settings,
        provider: "demo",
        model: "default-model",
        stageAgents: {
          screen: { provider: "claude", model: "screen-model" },
          score: { provider: "demo" },
          plan: { provider: "claude", model: "plan-model" },
          implement: { provider: "demo" },
        },
      };
      state.runtime.cliAvailable = true;
      state.integration.projectPath = "/synthetic/game";
      state.projects[0]!.projectPath = "/synthetic/game";
    });
    const engine = new WorkflowEngine(store, {
      runners: { demo: runner(seen), claude: runner(seen) },
      timers: nodeTimers(),
    });
    engines.push(engine);
    for (const stage of ["screen", "score", "plan", "implement"] as const) {
      await engine.submit("CF-107", stage);
      await engine.waitUntilIdle();
    }
    expect(
      seen.map((input) => [
        input.stage,
        input.settings.provider,
        input.settings.model,
      ]),
    ).toEqual([
      ["screen", "claude", "screen-model"],
      ["score", "demo", "default-model"],
      ["plan", "claude", "plan-model"],
      ["implement", "demo", "default-model"],
    ]);
    expect(
      store.snapshot().ideas.find((idea) => idea.id === "CF-107")?.status,
    ).toBe("review");
    expect(
      store
        .snapshot()
        .jobs.filter((job) => job.ideaId === "CF-107")
        .map((job) => [job.provider, job.model]),
    ).toEqual([
      ["claude", "screen-model"],
      ["demo", undefined],
      ["claude", "plan-model"],
      ["demo", undefined],
    ]);
  });
  it("requires the real project path and implementation permission for overridden Claude steps", async () => {
    const { store } = await seededStore();
    const seen: StageInput[] = [];
    await store.transaction((state) => {
      state.settings.stageAgents = {
        plan: { provider: "claude" },
        implement: { provider: "claude" },
      };
      state.runtime.cliAvailable = true;
    });
    const engine = new WorkflowEngine(store, {
      runners: { demo: runner(seen), claude: runner(seen) },
      timers: nodeTimers(),
    });
    engines.push(engine);
    await expect(engine.submit("CF-101", "plan")).rejects.toThrow(
      "repository path",
    );
    await store.transaction((state) => {
      state.integration.projectPath = "/synthetic/game";
      state.projects[0]!.projectPath = "/synthetic/game";
      const idea = state.ideas.find((idea) => idea.id === "CF-101")!;
      idea.status = "planned";
      idea.plan = samplePlan(idea.title, new Date().toISOString());
    });
    await expect(engine.submit("CF-101", "implement")).rejects.toThrow(
      "Real implementation is disabled",
    );
    expect(seen).toEqual([]);
  });
  it("keeps queued selections and the parent workspace when the streamer changes projects", async () => {
    const { store } = await seededStore();
    const seen: StageInput[] = [];
    let release = () => {};
    let began = () => {};
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    await store.transaction((state) => {
      state.settings = {
        ...state.settings,
        provider: "demo",
        stageAgents: { screen: { provider: "claude", model: "alpha-screen" } },
      };
      const first = state.projects[0]!;
      state.projects.push({
        ...structuredClone(first),
        id: "CFP-002",
        projectPath: "/other-project",
        settings: {
          ...state.settings,
          model: "beta-default",
          stageAgents: { screen: { provider: "claude", model: "beta-screen" } },
        },
      });
      const source = state.ideas.find((idea) => idea.id === "CF-107")!;
      state.ideas.push({
        ...structuredClone(source),
        id: "CF-200",
        number: 200,
        projectId: "CFP-002",
        title: "Another project request",
      });
      state.runtime.cliAvailable = true;
    });
    const execute: StageRunner = async (input) => {
      if (input.idea.id === "CF-107") {
        began();
        await blocked;
      }
      return runner(seen)(input);
    };
    const engine = new WorkflowEngine(store, {
      runners: { demo: execute, claude: execute },
      timers: nodeTimers(),
    });
    engines.push(engine);
    await engine.submit("CF-107", "screen");
    await started;
    try {
      const queued = await engine.submit("CF-200", "screen");
      expect(queued).toMatchObject({
        provider: "claude",
        model: "beta-screen",
      });
      await store.transaction((state) => {
        selectProjectState(state, "CFP-002");
        state.settings.model = "later-default";
        state.settings.stageAgents = {
          screen: { provider: "demo", model: "later-stage" },
        };
      });
    } finally {
      release();
    }
    await engine.waitUntilIdle();
    const second = seen.find((input) => input.idea.id === "CF-200");
    expect(second?.settings).toMatchObject({
      provider: "claude",
      model: "beta-screen",
    });
    expect(second?.integration.projectPath).toBe("/other-project");
    expect(
      store.snapshot().jobs.find((job) => job.ideaId === "CF-200"),
    ).toMatchObject({
      provider: "claude",
      model: "beta-screen",
      status: "succeeded",
    });
  });
  it("uses the configured stage provider during automatic processing", async () => {
    const { store } = await seededStore();
    const seen: StageInput[] = [];
    await store.transaction((state) => {
      state.settings = {
        ...state.settings,
        paused: false,
        automation: {
          screen: true,
          score: false,
          plan: false,
          implement: false,
        },
        stageAgents: {
          screen: { provider: "claude", model: "automatic-screen" },
        },
      };
      state.runtime.cliAvailable = true;
    });
    const engine = new WorkflowEngine(store, {
      runners: { demo: runner(seen), claude: runner(seen) },
      timers: nodeTimers(),
    });
    engines.push(engine);
    expect(await engine.tick(false)).toMatchObject({
      provider: "claude",
      model: "automatic-screen",
    });
    await engine.waitUntilIdle();
    expect(seen[0]?.settings).toMatchObject({
      provider: "claude",
      model: "automatic-screen",
    });
  });
  it("resolves the parent project stage and captures its provider/model before dispatch", async () => {
    const { store } = await seededStore();
    const seen: StageInput[] = [];
    await store.transaction((state) => {
      state.settings = {
        ...state.settings,
        provider: "demo",
        model: "project-model",
        stageAgents: { screen: { provider: "claude", model: "screen-model" } },
      };
      state.runtime.cliAvailable = true;
    });
    const engine = new WorkflowEngine(store, {
      runners: { demo: runner(seen), claude: runner(seen) },
      timers: nodeTimers(),
    });
    engines.push(engine);
    const queued = await engine.submit("CF-107", "screen");
    expect(queued).toMatchObject({ provider: "claude", model: "screen-model" });
    await engine.waitUntilIdle();
    expect(seen[0]?.settings).toMatchObject({
      provider: "claude",
      model: "screen-model",
    });
    expect(store.snapshot().jobs.at(-1)).toMatchObject({
      provider: "claude",
      model: "screen-model",
      status: "succeeded",
    });
  });
  it("enforces the selected stage runtime instead of the project default", async () => {
    const { store } = await seededStore();
    const seen: StageInput[] = [];
    await store.transaction((state) => {
      state.settings = {
        ...state.settings,
        provider: "demo",
        stageAgents: { screen: { provider: "claude" } },
      };
      state.runtime.cliAvailable = false;
    });
    const engine = new WorkflowEngine(store, {
      runners: { demo: runner(seen), claude: runner(seen) },
      timers: nodeTimers(),
    });
    engines.push(engine);
    await expect(engine.submit("CF-107", "screen")).rejects.toThrow(
      "CLI is not available",
    );
    expect(seen).toEqual([]);
    await store.transaction((state) => {
      state.settings = {
        ...state.settings,
        provider: "claude",
        stageAgents: { screen: { provider: "demo" } },
      };
    });
    await engine.submit("CF-107", "screen");
    await engine.waitUntilIdle();
    expect(seen[0]?.settings.provider).toBe("demo");
  });
});
