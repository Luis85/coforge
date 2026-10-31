import { expect, it } from 'vitest';
import { workflowDefinitionCheck, defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { agentDefinitionCheck } from '../../../features/coforge/domain/council-definitions';
import { buildClaudeArgs } from '../../../features/coforge/application/claude-protocol';
import { compileCouncil } from '../../../features/coforge/domain/council-protocol';
import { defaultCouncilDefinition, type TeamDefinition } from '../../../features/coforge/domain/council-definitions';
import { councilAdmission } from '../../../features/coforge/application/council-execution';
import { modelEfforts } from '../../../features/coforge/domain/provider-models';
import { workflowEditorIssues } from '../../../presentation/composables/coforge/workflow-editor-validation';

it('keeps incomplete editor drafts usable while a step changes type', () => {
  expect(modelEfforts('claude', undefined)).toEqual([]);
  expect(modelEfforts('claude', '')).toEqual([]);
});

it('takes unsupported effort repairs to the effort field', () => {
  const source = defaultWorkflowDefinition(defaultSettings());
  const step = source.steps[0]!;
  if (step.kind !== 'ai') throw new Error('Expected AI step');
  expect(workflowEditorIssues({ ...source, steps: [{ ...step, provider: 'claude', model: 'claude-opus-4-6', effort: 'xhigh' }] })[0]).toMatchObject({ target: 'effort', label: 'Screen · Reasoning effort' });
});

it('retains a model and effort in workflow definitions and sends the captured effort to Claude', () => {
  const source = defaultWorkflowDefinition(defaultSettings());
  const step = source.steps[0]!;
  const definition = workflowDefinitionCheck({ ...source, steps: [{ ...step, provider: 'claude', model: 'claude-opus-4-6', effort: 'max' }] });
  const captured = definition.steps[0]!;
  expect(captured).toMatchObject({ model: 'claude-opus-4-6', effort: 'max' });
  if (captured.kind !== 'ai') throw new Error('Expected an AI step');
  const args = buildClaudeArgs('screen', defaultSettings(), { runId: 'run', definitionRevision: 'revision', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [], step: captured });
  expect(args.slice(args.indexOf('--effort'), args.indexOf('--effort') + 2)).toEqual(['--effort', 'max']);
});

it('retains CoWorker effort while legacy definitions keep the provider default', () => {
  const legacy = { schema: 'agent/v1', id: 'reviewer', name: 'Reviewer', enabled: true, role: '', instructions: '', provider: 'claude', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } };
  expect(agentDefinitionCheck({ ...legacy, effort: 'high' })).toMatchObject({ effort: 'high' });
  expect(agentDefinitionCheck(legacy)).not.toHaveProperty('effort');
  const args = buildClaudeArgs('screen', defaultSettings());
  expect(args).not.toContain('--effort');
});

it('captures Council effort independently of later CoWorker edits', () => {
  const agent = agentDefinitionCheck({ schema: 'agent/v1', id: 'reviewer', name: 'Reviewer', enabled: true, role: '', instructions: 'Review', provider: 'claude', model: 'sonnet', effort: 'high', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } });
  const team: TeamDefinition = { schema: 'team/v1', id: 'team', name: 'Team', enabled: true, projectId: 'CFP-001', members: [agent.id], pinnedContext: [], recentMessages: 0, allowedRecipients: [] };
  const plan = compileCouncil(defaultCouncilDefinition('council', 'Council', team, [agent.id]), team, [agent]);
  const preview = { plan, source: { sourceId: 'source', revision: 'revision', generation: 0, markdown: 'Question' }, context: '', invocations: plan.invocations.length, warnings: [] };
  const limits = { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, simulation: false };
  const admitted = councilAdmission(preview, 'run', 'submission', limits);
  agent.effort = 'low';
  expect(admitted.invocations[0]).toMatchObject({ model: 'sonnet', effort: 'high' });
  const simulated = councilAdmission(preview, 'simulation', 'submission', { ...limits, simulation: true });
  expect(simulated.invocations[0]).toMatchObject({ provider: 'demo' });
  expect(simulated.invocations[0]).not.toHaveProperty('effort');
});

it.each([
  { provider: 'demo', model: 'sonnet', effort: 'high' },
  { provider: 'claude', model: 'claude-haiku-4-5', effort: 'max' },
  { provider: 'claude', model: 'claude-opus-4-6', effort: 'xhigh' },
  { provider: 'claude', model: 'sonnet', effort: '--tools' },
])('rejects unsupported model/effort combinations: $provider $model $effort', choice => {
  const source = defaultWorkflowDefinition(defaultSettings());
  expect(() => workflowDefinitionCheck({ ...source, steps: [{ ...source.steps[0], ...choice }] })).toThrow();
});
