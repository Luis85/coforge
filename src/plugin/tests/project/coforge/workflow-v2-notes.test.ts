import { describe, expect, it } from 'vitest';
import { readWorkflowV2Note, writeWorkflowV2Note } from '../../../infrastructure/coforge/workflow-v2-notes';
import type { WorkflowV2Definition } from '../../../features/coforge/domain/configured-workflow-v2';

const workflow = (): WorkflowV2Definition => ({ format: 'coforge-workflow/v2', revision: 'r1', name: 'Review', subjectMode: 'note', teamId: 'team', limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, maxInvocations: 10 }, collections: [],
  steps: [{ kind: 'approval', id: 'human', name: 'Read note', instructions: 'Review the submitted input' }] });
describe('canonical v2 workflow in project notes', () => {
  it('preserves unrelated YAML and body bytes across creation and edits', () => {
    const original = '---\r\ntype: coforge-project\r\nid: CFP-001\r\n# Human comment\r\nextension: "keep quotes"\r\n---\r\n\r\nHuman body\r\n  \r\n';
    const created = writeWorkflowV2Note(original, workflow(), ''); const read = readWorkflowV2Note(created);
    expect(read.definition?.name).toBe('Review'); expect(created).toContain('# Human comment\r\nextension: "keep quotes"'); expect(created.endsWith('\r\n\r\nHuman body\r\n  \r\n')).toBe(true);
    const edited = writeWorkflowV2Note(created, { ...workflow(), name: 'Second review' }, read.revision);
    expect(readWorkflowV2Note(edited).definition?.name).toBe('Second review'); expect(edited).toContain('# Human comment\r\nextension: "keep quotes"'); expect(edited.endsWith('\r\n\r\nHuman body\r\n  \r\n')).toBe(true);
  });
  it('rejects stale saves and invalid externally edited definitions without falling back', () => {
    const created = writeWorkflowV2Note('Human note\n', workflow(), '');
    expect(() => writeWorkflowV2Note(created, workflow(), 'stale')).toThrow('changed');
    expect(() => readWorkflowV2Note(created.replace('coforge-workflow/v2', 'coforge-workflow/v9'))).toThrow();
    expect(() => readWorkflowV2Note('---\ncoforge_workflow_v2: &bad { x: 1 }\ncopy: *bad\n---\n')).toThrow();
  });
});
