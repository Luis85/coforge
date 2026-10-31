import { expect, it } from "vitest";
import { createSeed, defaultSettings } from "../../../features/coforge/domain/seed";
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowAttemptRows } from '../../../presentation/composables/coforge/configured-workflow-history';
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
it('never describes a Council action as a manual streamer-only workflow', () => {
  const settings = defaultSettings();
  settings.workflow = { ...defaultWorkflowDefinition(settings), steps: [{ id: 'ask', kind: 'council', name: 'Ask Council', instructions: 'Advise.', councilId: 'advice', automatic: true }] };
  const summary = workflowProviderSummary(settings);
  expect(summary.label).toBe('Council workflow');
  expect(summary.title).toContain('Council discussion');
  expect(summary.title).not.toContain('Ask Council: Streamer');
});
it('attributes legacy Codex attempts to Codex when there is no captured configured workflow', () => {
  const idea = createSeed().ideas[0]!;
  const row = workflowAttemptRows([idea], [{ id: 'legacy-codex', ideaId: idea.id, stage: 'plan', status: 'succeeded', provider: 'codex', model: 'gpt-6.1-sol', startedAt: new Date().toISOString(), logs: [] }])[0];
  expect(row?.providerLabel).toBe('Codex · gpt-6.1-sol');
});
