import { expect, it } from "vitest";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import {
  stageAgentLabel,
  workflowProviderSummary,
} from "../../../presentation/composables/coforge/agent-labels";
it("makes mixed workflow providers explicit and labels each step by its actual model", () => {
  const settings = {
    ...defaultSettings(),
    provider: "demo" as const,
    stageAgents: { screen: { provider: "claude" as const, model: "haiku" } },
  };
  expect(workflowProviderSummary(settings)).toMatchObject({
    mode: "mixed",
    label: "Mixed providers",
  });
  expect(stageAgentLabel(settings, "screen")).toBe("Claude Code · haiku");
  expect(stageAgentLabel(settings, "implement")).toBe("Simulation");
  expect(workflowProviderSummary(defaultSettings()).mode).toBe("demo");
});
