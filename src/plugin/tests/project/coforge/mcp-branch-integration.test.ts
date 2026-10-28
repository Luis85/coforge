import { describe, expect, it } from "vitest";
import { ConfiguredWorkflowEngine } from "../../../features/coforge/application/configured-workflow-engine";
import { AICostService } from "../../../features/coforge/application/ai-cost-service";
import { createIdea } from "../../../features/coforge/application/chat";
import type { StageInput } from "../../../features/coforge/application/ports";
import { executionTaskPrompt } from "../../../features/coforge/application/workflow-execution";
import { collectCostTasks } from "../../../features/coforge/domain/ai-cost-snapshot";
import {
  aiCostTaskCheck,
  taskCost,
  type AICostTask,
} from "../../../features/coforge/domain/ai-costs";
import {
  attributionCoverage,
  costAttributionGroups,
} from "../../../features/coforge/domain/ai-cost-groups";
import { tokenSummary } from "../../../features/coforge/domain/ai-usage";
import {
  ideaBody,
  ideaProperties,
  parseIdeaNote,
} from "../../../features/coforge/domain/idea-note";
import { parsePersistedStudio } from "../../../features/coforge/domain/persisted";
import { ai, definition } from "./configured-workflow-fixture";
import { emptyStore, nodeTimers, toLoaded } from "./memory-storage";
async function fixture(provider: "demo" | "claude" = "demo") {
  const { store } = await emptyStore();
  const ids = await store.transaction((state) => {
    state.settings.workflow = definition([
      { ...ai("first"), provider },
      { ...ai("second"), provider },
    ]);
    state.settings.paused = false;
    state.settings.requestObject = {
      format: "coforge-request-object/v1",
      className: "Business Idea",
      categories: ["Commercial"],
      fields: [{ key: "audience", label: "Audience", type: "text" }],
    };
    const external = createIdea(state, {
      username: "Owner",
      title: "Captured external request",
      description: "Keep the captured schema.",
      category: "Commercial",
      requestValues: { audience: "PRIVATE_CAPTURED_AUDIENCE" },
    });
    const native = createIdea(state, {
      username: "Owner",
      title: "Independent native request",
      description: "This native workflow must keep progressing.",
      category: "Commercial",
    });
    return { external: external.id, native: native.id };
  });
  const calls: StageInput[] = [];
  const runner = async (input: StageInput) => {
    calls.push(input);
    return { markdown: "# External result" };
  };
  const engine = new ConfiguredWorkflowEngine(store, {
    runners: { demo: runner, claude: runner, mcp: runner },
    cost: async () => {},
    usage: async () => {},
  });
  await engine.start(ids.external, true, undefined, true);
  const job = store
    .snapshot()
    .jobs.find((item) => item.ideaId === ids.external)!;
  await engine.run(job, new AbortController().signal);
  return { store, engine, ids, calls, jobId: job.id };
}
describe("MCP integration with captured requests and private analytics", () => {
  it("does not let an explicitly stepped MCP run starve native automatic workflows in the same project", async () => {
    const f = await fixture();
    try {
      expect(
        f.store.snapshot().ideas.find((idea) => idea.id === f.ids.external)
          ?.workflowRun,
      ).toMatchObject({ external: true, state: "ready", cursor: 1 });
      const queued = await f.engine.tick(
        f.store.snapshot().activeProjectId!,
        false,
      );
      expect(queued).toMatchObject({ ideaId: f.ids.native, provider: "demo" });
      expect(
        f.store.snapshot().ideas.find((idea) => idea.id === f.ids.external)
          ?.workflowRun?.cursor,
      ).toBe(1);
    } finally {
      f.store.disposeObservers();
    }
  });
  it("permits explicitly stepping an external run without requiring its saved native CLI provider", async () => {
    const f = await fixture("claude");
    try {
      const queued = await f.engine.tick(
        f.store.snapshot().activeProjectId!,
        true,
      );
      expect(queued).toMatchObject({ ideaId: f.ids.external, provider: "mcp" });
    } finally {
      f.store.disposeObservers();
    }
  });
  it("preserves custom request values and taxonomy in MCP context, notes, revisions and persisted job evidence", async () => {
    const f = await fixture();
    try {
      await f.store.transaction((state) => {
        state.settings.requestObject = {
          format: "coforge-request-object/v1",
          className: "Future Feature",
          categories: ["Future"],
          fields: [],
        };
      });
      const context = executionTaskPrompt(f.calls[0]!);
      expect(context).toContain("PRIVATE_CAPTURED_AUDIENCE");
      expect(context).toContain("Commercial");
      expect(context).not.toContain("Future Feature");
      const idea = f.store
        .snapshot()
        .ideas.find((item) => item.id === f.ids.external)!;
      const restored = parseIdeaNote(
        ideaProperties(idea, "Owner"),
        ideaBody(idea),
      );
      expect(restored.requestObject).toEqual(idea.requestObject);
      expect(restored.category).toBe("Commercial");
      expect(restored.workflowRun).toMatchObject({ external: true, cursor: 1 });
      expect(
        parsePersistedStudio(
          toLoaded(f.store.internalSnapshot()).data,
        ).jobs.find((job) => job.id === f.jobId),
      ).toMatchObject({ provider: "mcp" });
    } finally {
      f.store.disposeObservers();
    }
  });
  it("retains unknown real MCP usage and permits a sourced manual fallback without inventing agent, team, council, model or tokens", async () => {
    const f = await fixture();
    let saved: AICostTask[] = [];
    const collect = () =>
      collectCostTasks(f.store.snapshot(), []).filter(
        (task) => task.id === `job:${f.jobId}`,
      );
    const service = new AICostService(
      f.store,
      {
        load: async () => structuredClone(saved),
        save: async (value) => {
          saved = structuredClone(value);
        },
      },
      collect,
      nodeTimers(),
    );
    try {
      await service.start();
      const task = aiCostTaskCheck(service.snapshot().tasks[0]);
      expect(task).toMatchObject({ provider: "mcp", status: "succeeded" });
      expect(taskCost(task)).toEqual({ source: "unavailable" });
      expect(task.model).toBeUndefined();
      expect(task.attribution).toBeUndefined();
      expect(task.usage).toBeUndefined();
      expect(attributionCoverage([task])).toEqual({
        total: 1,
        agent: 0,
        team: 0,
        council: 0,
      });
      expect(costAttributionGroups([task], "agent")).toEqual([]);
      expect(tokenSummary([task])).toMatchObject({
        realTasks: 1,
        inputTasks: 0,
        outputTasks: 0,
      });
      await service.setManual(
        task.id,
        "0.125",
        "External provider billing receipt",
        JSON.stringify(task),
      );
      await service.refresh();
      const manual = service.snapshot().tasks[0]!;
      expect(taskCost(manual)).toEqual({ source: "manual", nanos: 125000000n });
      expect(manual.attribution).toBeUndefined();
      expect(manual.usage).toBeUndefined();
      expect(manual.provider).toBe("mcp");
      expect(saved[0]).toMatchObject({
        manualUsd: "0.125",
        manualNote: "External provider billing receipt",
      });
      await service.setManual(manual.id, null, "", JSON.stringify(manual));
      expect(taskCost(service.snapshot().tasks[0]!)).toEqual({
        source: "unavailable",
      });
    } finally {
      await service.dispose();
      f.store.disposeObservers();
    }
  });
});
