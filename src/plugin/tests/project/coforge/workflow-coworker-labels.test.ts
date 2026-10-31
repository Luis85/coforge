import { expect, it } from 'vitest';
import { createSeed, defaultIntegration, defaultRuntime, defaultSettings } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { initialProject } from '../../../features/coforge/domain/projects';
import { configuredAgentLabel } from '../../../presentation/composables/coforge/configured-workflow-display';
import { workflowProviderSummary } from '../../../presentation/composables/coforge/agent-labels';
import { ideaWorkflowAction } from '../../../presentation/composables/coforge/idea-workflow-action';

it('never advertises an unresolved assigned CoWorker as a free simulation from its stale preview values', () => {
  const settings = defaultSettings();
  const source = defaultWorkflowDefinition(settings); const step = source.steps[0]!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  const assigned = { ...step, coworkerId: 'saved-worker', provider: 'demo' as const };
  settings.workflow = { ...source, steps: [assigned] };
  const project = initialProject(settings, defaultIntegration(), new Date().toISOString());
  const idea = { ...createSeed().ideas[0]!, projectId: project.id, status: 'inbox' as const };
  const summary = workflowProviderSummary(settings);
  expect(summary.mode).not.toBe('demo'); expect(summary.label).toContain('CoWorker');
  expect(summary.title).toContain('captured at run start'); expect(summary.title).not.toContain('Simulation');
  expect(configuredAgentLabel(assigned)).toContain('Assigned CoWorker');
  const action = ideaWorkflowAction(idea, project, defaultRuntime());
  expect(action?.demo).toBe(false); expect(action?.description).toContain('captured at run start'); expect(action?.description).not.toContain('no model call');
});

it('shows the captured provider/model for assigned runs and preserves manual and external MCP labels', () => {
  const settings = defaultSettings(); const source = defaultWorkflowDefinition(settings); const step = source.steps[0]!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  const captured = { ...step, coworkerId: 'saved-worker', provider: 'codex' as const, model: 'gpt-6.1-sol', effort: 'high' as const };
  settings.workflow = { ...source, steps: [captured] };
  expect(configuredAgentLabel(captured, true)).toContain('Codex · gpt-6.1-sol · high effort');
  expect(workflowProviderSummary(settings, false, true)).toMatchObject({ mode: 'codex', label: 'Codex CLI' });
  expect(workflowProviderSummary(settings, false, true).title).toContain('gpt-6.1-sol');
  expect(workflowProviderSummary(settings, true, true)).toMatchObject({ mode: 'mcp', label: 'External MCP client' });
  expect(workflowProviderSummary(defaultSettings()).label).toBe('Simulation');
  expect(configuredAgentLabel({ ...step, provider: 'demo' })).toBe('Simulation · no model call');
});
