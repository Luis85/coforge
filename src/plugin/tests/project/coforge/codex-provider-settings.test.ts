import { expect, it } from 'vitest';
import { workflowDefinitionCheck, defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { agentDefinitionCheck } from '../../../features/coforge/domain/council-definitions';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { modelEfforts, providerModels } from '../../../features/coforge/domain/provider-models';

it('saves Codex model and effort for workflow steps and reusable CoWorkers', () => {
  const source = defaultWorkflowDefinition(defaultSettings());
  expect(workflowDefinitionCheck({ ...source, steps: [{ ...source.steps[0], provider: 'codex', model: 'gpt-6.1-sol', effort: 'xhigh' }] }).steps[0]).toMatchObject({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'xhigh' });
  expect(agentDefinitionCheck({ schema: 'agent/v1', id: 'codex-reviewer', name: 'Codex reviewer', enabled: true, provider: 'codex', model: 'gpt-6.1-sol', effort: 'high', role: 'Reviewer', instructions: 'Review', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } })).toMatchObject({ provider: 'codex', effort: 'high' });
});

it('filters effort by provider instead of offering Claude-only max for every model', () => {
  expect(providerModels('codex').map(model => model.value)).toContain('gpt-6.1-sol');
  expect(modelEfforts('codex', 'gpt-6.1-sol')).toContain('xhigh');
  expect(modelEfforts('codex', 'sonnet')).toEqual([]);
  expect(modelEfforts('claude', 'gpt-6.1-sol')).toEqual([]);
});
