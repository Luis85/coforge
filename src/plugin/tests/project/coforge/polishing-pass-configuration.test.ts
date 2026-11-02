import { expect, it } from 'vitest';
import { workflowDefinitionCheck, serializeWorkflowDefinition, parseWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { defaultImprovementPass, improvementPassConfigurationCheck } from '../../../features/coforge/domain/polishing-pass-configuration';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { prepareWorkflowCopy } from '../../../features/coforge/application/workflow-copy';
import { ai, definition } from './configured-workflow-fixture';
import { validateNativeWorkflowTools } from '../../../features/coforge/domain/native-workflow-tools';

it('saves one optional manual polishing action independently of ordered workflow progress and retains it in portable copies', () => {
  const pass = { ...defaultImprovementPass(defaultSettings()), provider: 'claude' as const, model: 'sonnet', instructions: 'Improve the current result using reviewed feedback.', coworkerId: 'saved-worker' };
  const source = definition([ai('analysis')]);
  expect(workflowDefinitionCheck(source).improvementPass).toBeUndefined();
  const saved = workflowDefinitionCheck({ ...source, improvementPass: pass });
  expect(saved.steps).toEqual(source.steps); expect(saved.improvementPass).toEqual(pass);
  expect(parseWorkflowDefinition(serializeWorkflowDefinition(saved)).improvementPass).toEqual(pass);
  const copy = prepareWorkflowCopy(saved, 'independent-copy').definition;
  copy.improvementPass!.instructions = 'Independent project instructions'; copy.improvementPass!.limits.maxTurns = 4;
  expect(saved.improvementPass!.instructions).toBe(pass.instructions); expect(saved.improvementPass!.limits.maxTurns).toBe(pass.limits.maxTurns);
});
it('validates the configurable identity, instructions, short bounds and optional code policy without authored access or automatic dispatch fields', () => {
  const pass = defaultImprovementPass(defaultSettings()); const source = definition([ai('analysis')]);
  for (const patch of [{ instructions: '' }, { model: '../binary' }, { provider: 'unknown' }, { automatic: true }, { output: 'codechange' }, { access: 'editworktree' },
    { limits: { ...pass.limits, timeoutSeconds: 0 } }, { limits: { ...pass.limits, maxTurns: 0 } }, { limits: { ...pass.limits, maxBudgetUsd: Infinity } },
    { execution: { mode: 'background', maxRuntimeSeconds: 0 } }]) expect(() => workflowDefinitionCheck({ ...source, improvementPass: { ...pass, ...patch } })).toThrow();
  expect(workflowDefinitionCheck({ ...source, improvementPass: { ...pass, provider: 'codex', model: 'gpt-6.1-sol', effort: 'high',
    execution: { mode: 'background', maxRuntimeSeconds: 360000, maxTurns: 1000, maxBudgetUsd: 200 } } }).improvementPass?.execution).toMatchObject({ maxRuntimeSeconds: 360000 });
});

it('preserves configured native tools without imposing a legacy deadline on future ordinary polishing', () => {
  const source = definition([ai('analysis')]);
  const pass = { ...defaultImprovementPass(defaultSettings()), provider: 'claude' as const, nativeTools: { delegation: { maxConcurrent: 2 }, verification: { commandIds: ['test'] } } };
  const saved = workflowDefinitionCheck({ ...source, improvementPass: pass });
  expect(parseWorkflowDefinition(serializeWorkflowDefinition(saved)).improvementPass?.nativeTools).toEqual(pass.nativeTools);
  expect(workflowDefinitionCheck({ ...source, improvementPass: { ...pass, provider: 'codex' } }).improvementPass?.nativeTools).toEqual(pass.nativeTools);
  expect(() => validateNativeWorkflowTools({ provider: 'codex', access: 'editworktree', output: 'codechange', nativeTools: pass.nativeTools, execution: { mode: 'background' } })).toThrow('elapsed deadline');
  expect(() => workflowDefinitionCheck({ ...source, improvementPass: { ...pass, provider: 'herdr' } })).toThrow('native Claude');
});

it.each([{ provider: 'claude' as const, model: 'sonnet' }, { provider: 'codex' as const, model: 'gpt-6.1-sol' }])('saves and re-enables analytical improvement tools using the implicit ordinary code contract ($provider)', ({ provider, model }) => {
  const configuration = { ...defaultImprovementPass(defaultSettings()), provider, model, nativeTools: { delegation: false as const, research: false } };
  const disabled = improvementPassConfigurationCheck(configuration);
  expect(disabled.nativeTools).toEqual({ delegation: false, research: false });
  const restored = improvementPassConfigurationCheck({ ...disabled, nativeTools: { delegation: { maxConcurrent: 2 }, research: true } });
  expect(restored.nativeTools).toEqual({ delegation: { maxConcurrent: 2 }, research: true });
  expect(restored.execution).toBeUndefined();
  expect(restored).not.toHaveProperty('access'); expect(restored).not.toHaveProperty('output');
});
