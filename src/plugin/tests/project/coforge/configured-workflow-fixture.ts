import { vi } from "vitest";
import { WorkflowEngine, type EngineOptions } from "../../../features/coforge/application/engine";
import type {
  StageInput,
  StageResult,
  StageRunner,
} from "../../../features/coforge/application/ports";
import {
  defaultWorkflowDefinition,
  type AiWorkflowStep,
  type WorkflowDefinition,
  type WorkflowStep,
} from "../../../features/coforge/domain/configured-workflow";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import type { Increment } from "../../../features/coforge/domain/types";
import { seededStore, nodeTimers } from "./memory-storage";

export const ai = (
  id: string,
  output: AiWorkflowStep["output"] = "markdown",
  access: AiWorkflowStep["access"] = "none",
): AiWorkflowStep => ({
  id,
  name: id,
  instructions: `Instructions for ${id}`,
  kind: "ai",
  output,
  access,
  provider: "demo",
  model: "sonnet",
  automatic: true,
});
export const definition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  ...defaultWorkflowDefinition(defaultSettings()),
  revision: "custom-v1",
  name: "Custom workflow",
  steps,
});
export const increment: Increment = {
  summary: "Changed game code",
  files: [{ path: "game.ts", additions: 1, deletions: 0 }],
  tests: ["Not run"],
  diff: "+code",
  simulated: true,
  createdAt: "2026-10-28T10:00:00Z",
};
export const result = (input: StageInput): StageResult => {
  switch (input.workflow?.step.output) {
    case "screening":
      return {
        screening: {
          verdict: "clear",
          reason: "A normal feature.",
          signals: [],
          provider: input.settings.provider,
          checkedAt: new Date().toISOString(),
        },
      };
    case "rice":
      return {
        rice: {
          reach: 10,
          impact: 1,
          confidence: 1,
          effort: 1,
          score: 10,
          rationale: "Estimated",
        },
      };
    case "plan":
      return {
        plan: {
          summary: "Plan",
          steps: ["Make change"],
          acceptanceCriteria: ["Works"],
          risks: [],
          markdown: "# Plan",
          createdAt: new Date().toISOString(),
        },
      };
    case "codechange":
      return { summary: "No changes needed." };
    default:
      return { markdown: `# ${input.workflow?.step.id}` };
  }
};
export async function fixture(steps: WorkflowStep[], custom?: StageRunner, guard?: EngineOptions['assertWorkflowReviewable']) {
  const { store, storage } = await seededStore();
  await store.transaction((state) => {
    state.settings.workflow = definition(steps);
    state.settings.paused = false;
    state.integration.projectPath = "/synthetic/game";
    state.integration.allowImplementation = true;
    state.runtime.cliAvailable = true;
  });
  const idea = store.snapshot().ideas.find((idea) => idea.status === "inbox")!;
  const calls: StageInput[] = [];
  const runner = vi.fn<StageRunner>(async (input) => {
    calls.push(input);
    return custom ? custom(input) : result(input);
  });
  const engine = new WorkflowEngine(store, {
    runners: { demo: runner, claude: runner, herdr: runner },
    timers: nodeTimers(),
    assertWorkflowReviewable: guard,
  });
  const current = () =>
    store.snapshot().ideas.find((item) => item.id === idea.id)!;
  return { store, storage, idea, calls, runner, engine, current };
}

