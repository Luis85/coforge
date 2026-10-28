import { expect, it } from 'vitest';
import type { ExecutionRun } from '../../../features/coforge/domain/execution-run';
import type { CouncilRuntimeSnapshot } from '../../../features/coforge/application/council-ports';
import type { CouncilTaskRecord } from '../../../features/coforge/application/council-tasks';
import { councilTaskHistory } from '../../../presentation/composables/coforge/council-task-history';

const at = '2026-10-28T10:00:00Z';
function retainedRun(): ExecutionRun {
  return {
    id: 'retained', submissionKey: 'submission-one', projectId: 'CFP-001', teamId: 'team', context: '',
    subject: { kind: 'note', sourceId: 'task-one', revision: 'revision', markdown: '\uFEFF---\r\ncoforge_task:\r\n  title: Captured question\r\n---\r\n# Captured question\r\n\r\nOriginal question.' },
    invocations: [{ id: 'invocation', roundId: 'opinions', agentId: 'agent', agentRevision: 'agent-revision', provider: 'claude', model: 'sonnet', instructions: 'Give an independent opinion.', access: 'none', inputRoundIds: [] }],
    cursor: 1, state: 'completed', createdAt: at, updatedAt: at,
    attempts: [{ id: 'attempt', invocationId: 'invocation', status: 'published', startedAt: at, dispatch: { prompt: 'Captured input', inputArtifactIds: [] }, artifactId: 'artifact', skipped: true }],
    artifacts: [{ id: 'artifact', runId: 'retained', invocationId: 'invocation', attemptId: 'attempt', roundId: 'opinions', agentId: 'agent', agentRevision: 'agent-revision', provider: 'claude', model: 'sonnet', inputArtifactIds: [], createdAt: at, markdown: 'Explicitly skipped', simulated: false, skipped: true, skipReason: 'Operator decision' }],
  };
}
function snapshot(runs: ExecutionRun[]): CouncilRuntimeSnapshot {
  return { ready: true, paused: false, executor: true, deviceId: 'local', preferences: { format: 'coforge-council-settings/v1', revision: 1, executorId: 'local', bindings: [] }, runs, intake: [], error: '' };
}
const task = (sourceId: string, title: string): CouncilTaskRecord => ({ sourceId, title, path: `CoForge/CouncilTasks/${sourceId}.md`, projectId: 'CFP-001', target: { kind: 'council', id: 'council', teamId: 'team' }, createdAt: at });

it('shows captured headings instead of YAML or later edits and does not count skips as published opinions', () => {
  const rows = councilTaskHistory(snapshot([retainedRun()]), [task('task-one', 'A later edited title')]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ title: 'Captured question', projectId: 'CFP-001', runId: 'retained' });
  expect(rows[0]?.title).not.toBe('---');
  expect(rows[0]?.detail).toContain('1/1 steps completed or skipped');
  expect(rows[0]?.detail).not.toContain('contributions published');
});

it('distinguishes retained runs across projects, saved notes without retained history and inbox observations', () => {
  const unknown: ExecutionRun = { ...retainedRun(), id: 'unknown', submissionKey: 'submission-two', projectId: 'CFP-002', subject: { kind: 'note', sourceId: 'other-source', revision: 'r2', markdown: '# A watched task' }, cursor: 0, state: 'attention', artifacts: [], attempts: [{ id: 'uncertain', invocationId: 'invocation', status: 'unknown', startedAt: at, dispatch: { prompt: 'Captured input', inputArtifactIds: [] } }] };
  const current = snapshot([retainedRun(), unknown]);
  current.intake = [{ path: 'Private/Inbox/Not-ready.md', sourceId: 'not-admitted', status: 'not-ready' }];
  const rows = councilTaskHistory(current, [task('task-one', 'Current title'), task('task-saved', 'A saved question')]);
  expect(rows.filter(row => row.kind === 'run').map(row => row.projectId).sort()).toEqual(['CFP-001', 'CFP-002']);
  expect(rows.find(row => row.runId === 'unknown')?.status).toContain('Outcome unknown');
  const saved = rows.find(row => row.kind === 'draft');
  expect(saved?.status).toBe('Saved note · no retained run');
  expect(saved?.detail).toContain('history may have been cleared');
  expect(saved?.detail).not.toContain('No run has been admitted');
  expect(rows.find(row => row.kind === 'observed')).toMatchObject({ status: 'Inbox observation · not-ready' });
  expect(rows.find(row => row.kind === 'observed')?.runId).toBeUndefined();
});
