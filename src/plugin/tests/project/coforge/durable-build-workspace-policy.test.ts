import { expect, it } from 'vitest';
import { workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { workflowEditorIssues } from '../../../presentation/composables/coforge/workflow-editor-validation';
import { ai, definition } from './configured-workflow-fixture';

const background = () => ({ ...ai('background', 'codechange', 'editworktree'), provider: 'claude' as const, execution: { mode: 'background' as const } });
const foreground = () => ({ ...ai('foreground', 'codechange', 'editworktree'), provider: 'claude' as const });

it('rejects mixed workspace writers before a workflow can save or dispatch and identifies the editing policy to repair', () => {
  for (const steps of [[foreground(), background()], [background(), foreground()]]) {
    const source = definition(steps);
    expect(() => workflowDefinitionCheck(source)).toThrow(/editing steps.*background/iu);
    expect(workflowEditorIssues(source)).toContainEqual(expect.objectContaining({ stepId: 'foreground', target: 'execution', label: 'Build execution' }));
  }
  expect(() => workflowDefinitionCheck(definition([background(), { ...foreground(), coworkerId: 'saved-worker', provider: 'demo' }]))).toThrow(/editing steps.*background/iu);
});
it('keeps legacy writers and supports native readonly/no-access follow-ups plus multiple background writers', () => {
  expect(workflowDefinitionCheck(definition([foreground(), { ...foreground(), id: 'second-foreground' }])).steps).toHaveLength(2);
  const source = definition([background(), { ...ai('read', 'markdown', 'readproject'), provider: 'codex', model: 'gpt-6.1-sol' },
    { ...ai('summary'), provider: 'claude' }, { ...background(), id: 'next-background' }]);
  expect(workflowDefinitionCheck(source).steps).toHaveLength(4);
});
