import { AICostService } from "../../src/plugin/features/coforge/application/ai-cost-service";
import { ScheduleService } from "../../src/plugin/features/coforge/application/schedule-service";
import type { AICostTask } from "../../src/plugin/features/coforge/domain/ai-costs";
import type { ScheduleNote } from "../../src/plugin/features/coforge/domain/schedule";
import { scheduleBody } from "../../src/plugin/features/coforge/domain/schedule";
import type { StudioStore } from "../../src/plugin/features/coforge/application/studio-store";
import type { Timers } from "../../src/plugin/features/coforge/application/ports";
export function createWorkspacePreview(store: StudioStore, timers: Timers) {
  let tasks: AICostTask[] = [
    {
      id: "example-screen-1",
      attribution: { kind: 'council', agentId: 'example-designer', agentName: 'Design reviewer', agentNamespace: 'reusable', teamId: 'example-studio', teamName: 'Studio team', councilId: 'example-design', councilName: 'Design Council', runId: 'example-discussion' },
      featureId: "CF-001",
      featureTitle: "Village trading",
      projectId: "CFP-001",
      projectName: "Example project",
      provider: "claude",
      stage: "screen",
      status: "done",
      startedAt: "2026-10-26T17:00:00.000Z",
      model: "example-model",
      reportedUsd: 0.0125,
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        cacheReadInputTokens: 40,
        cacheCreationInputTokens: 10,
      },
      usageSource: "provider",
    },
    {
      id: "example-build-1",
      attribution: { kind: 'agent', agentId: 'example-builder', agentName: 'Implementation reviewer', agentNamespace: 'reusable', teamId: 'example-studio', teamName: 'Studio team', runId: 'example-build' },
      featureId: "CF-001",
      featureTitle: "Village trading",
      projectId: "CFP-001",
      projectName: "Example project",
      provider: "claude",
      stage: "build",
      status: "failed",
      startedAt: "2026-10-26T17:10:00.000Z",
      reportedUsd: 0.45,
      usage: {
        inputTokens: 80,
        outputTokens: 50,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      usageSource: "provider",
    },
    {
      id: "example-herdr-1",
      featureId: "CF-002",
      featureTitle: "Garden paths",
      projectId: "CFP-001",
      projectName: "Example project",
      provider: "herdr",
      stage: "dispatch",
      status: "delivered",
      startedAt: "2026-10-26T17:20:00.000Z",
    },
  ];
  const costs = new AICostService(
    store,
    {
      load: async () => structuredClone(tasks),
      save: async (next) => {
        tasks = structuredClone(next);
      },
    },
    () => [],
    timers,
  );
  let started = false;
  const notes: ScheduleNote[] = [];
  const schedule = new ScheduleService(
    {
      list: async () => structuredClone(notes),
      save: async (plan, expected) => {
        const before = notes.find((note) => note.plan.id === plan.id);
        if ((before?.revision ?? null) !== expected)
          throw new Error("Example plan changed. Refresh first.");
        const note = {
          plan,
          body: before?.body ?? scheduleBody(plan),
          revision: crypto.randomUUID(),
        };
        const index = notes.findIndex((note) => note.plan.id === plan.id);
        if (index < 0) notes.push(note);
        else notes[index] = note;
        return structuredClone(note);
      },
      open: async () => {
        throw new Error("Opening a Markdown note requires Obsidian.");
      },
    },
    {
      project: async () => {},
      channel: async () => {},
      scenes: async () => {},
      music: async () => { throw new Error("Preparing OBS music requires the Obsidian plugin."); },
    },
    store,
  );
  return {
    costs: () => {
      if (!started) {
        started = true;
        void costs.start();
      }
      return costs;
    },
    schedule,
  };
}
