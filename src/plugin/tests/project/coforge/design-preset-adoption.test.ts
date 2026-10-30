import { expect, it } from 'vitest';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition, type WorkflowStep } from '../../../features/coforge/domain/configured-workflow';
import { insertWorkflowPreset } from '../../../presentation/stores/workflow-editor-draft';

const ai = (id: string, output: 'plan' | 'screening' | 'markdown' | 'codechange', access: 'none' | 'readproject' | 'editworktree' = 'none'): WorkflowStep => ({ id, name: id, kind: 'ai', output, access, instructions: 'Complete this step.', provider: 'demo', model: 'sonnet', automatic: false });
it.each([{ label: 'omitted', inputs: undefined }, { label: 'empty', inputs: [] }])('keeps all-prior context dynamic when Design adopts a Build with $label inputs', ({ inputs }) => {
  const settings = defaultSettings();
  const build = { ...ai('build', 'codechange', 'editworktree'), inputs };
  const draft = { ...defaultWorkflowDefinition(settings), steps: [ai('screen', 'screening'), ai('plan', 'plan', 'readproject'), { id: 'council', name: 'Council advice', kind: 'council' as const, councilId: 'council-one', instructions: 'Review the plan.', automatic: false }, ai('edit', 'markdown', 'editworktree'), build] };
  insertWorkflowPreset(draft, 'design', settings);
  expect(draft.steps.map(step => step.name)).toEqual(['screen', 'plan', 'Council advice', 'edit', 'Design', 'build']);
  expect(build).toMatchObject({ inputs: ['design'], includePreviousResults: true });
});

it('preserves explicit required roles and the all-prior flag during Design adoption', () => {
  const settings = defaultSettings();
  const build = { ...ai('build', 'codechange', 'editworktree'), inputs: ['plan' as const], includePreviousResults: true };
  const draft = { ...defaultWorkflowDefinition(settings), steps: [ai('plan', 'plan', 'readproject'), build] };
  insertWorkflowPreset(draft, 'design', settings);
  expect(build).toMatchObject({ inputs: ['plan', 'design'], includePreviousResults: true });
});

it('inserts Design before the first Build with an earlier Plan while preserving an earlier independent Build', () => {
  const settings = defaultSettings();
  const early = ai('independent-build', 'codechange', 'editworktree');
  const planned = ai('planned-build', 'codechange', 'editworktree');
  const draft = { ...defaultWorkflowDefinition(settings), steps: [early, ai('plan', 'plan', 'readproject'), planned] };
  insertWorkflowPreset(draft, 'design', settings);
  expect(draft.steps.map(step => step.name)).toEqual(['independent-build', 'plan', 'Design', 'planned-build']);
});
