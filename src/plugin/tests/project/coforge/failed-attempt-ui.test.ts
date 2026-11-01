// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import type { AgentJob } from '../../../features/coforge/domain/types';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowArtifactHash } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { providerFailureFor } from '../../../features/coforge/domain/provider-failure';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture() {
  const f = await workflowUiFixture(); const at = '2026-11-01T13:00:00Z';
  const idea = { ...createSeed().ideas.find(idea => idea.increment)!, projectId: f.project.id, lastError: 'Inspect retained conversation and workspace before an explicit retry.' };
  const step = { ...ai('build', 'codechange', 'editworktree'), name: 'Captured Build', provider: 'codex' as const };
  const run: WorkflowRun = { id: 'original-run', ideaId: idea.id, projectId: f.project.id, definition: definition([step]), proposalRevision: 'proposal',
    revision: 1, cursor: 0, state: 'attention', createdAt: at, updatedAt: at, artifacts: [],
    attempts: [{ id: 'original-attempt', jobId: 'original-job', stepId: step.id, stepName: step.name, kind: 'ai', status: 'failed', inputs: [], startedAt: at, error: idea.lastError }] };
  idea.workflowRun = run;
  const job: AgentJob = { id: 'original-job', ideaId: idea.id, projectId: f.project.id, provider: 'codex', model: 'captured-model', stage: 'implement',
    status: 'failed', startedAt: at, logs: [], error: idea.lastError,
    workflow: { runId: run.id, attemptId: 'original-attempt', definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision, step, inputArtifacts: [] } };
  f.store.state!.ideas = [idea]; f.store.state!.jobs = [job]; f.store.select(idea.id, 'sessions');
  const wrapper = mount(IdeaDrawer, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  return { ...f, wrapper, idea: f.store.state!.ideas[0]!, run: f.store.state!.ideas[0]!.workflowRun!, job: f.store.state!.jobs[0]!, close: async () => { wrapper.unmount(); await f.dispose(); } };
}

it('makes a legacy failed Build with empty logs honest and opens its exact original attempt instead of implying older increment changes belong to it', async () => {
  const f = await fixture();
  try {
    const saves = f.storage.saves;
    const failure = f.wrapper.get('[aria-label="Recorded attempt failure"]');
    expect(failure.text()).toContain('Specific cause was not recorded'); expect(failure.text()).toContain('original-attempt');
    expect(failure.text()).toContain('No response captured'); expect(failure.text()).toContain('No workspace captured');
    expect(failure.text()).toContain('No retained changes captured for this attempt');
    expect(f.wrapper.get('[aria-label="Session Peek"]').text()).not.toContain('Open current increment');
    expect(failure.findAll('button').some(button => /Retry|Restart|Check original|Accept/iu.test(button.text()))).toBe(false);
    await failure.findAll('button').find(button => button.text() === 'Read original attempt details')!.trigger('click'); await flushPromises();
    expect(f.store.drawerTab).toBe('activity');
    const original = f.wrapper.get('[data-job-id="original-job"]'); expect(original.attributes('open')).toBeDefined();
    expect(document.activeElement).toBe(original.get('summary').element);
    expect(f.storage.saves).toBe(saves); expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('shows an explicit captured provider cause with original-execution prerequisite while Sessions remains readonly', async () => {
  const f = await fixture();
  try {
    f.job.failure = providerFailureFor('authentication');
    f.job.nativeProcess = { runId: 'original-run', attemptId: 'original-attempt', projectId: f.project.id,
      identity: { pid: 4242, platform: 'win32', birth: 'captured-birth', image: 'f'.repeat(64) }, phase: 'unknown', observedAt: f.job.startedAt };
    f.job.conversation = { capturedAt: f.job.startedAt, instructions: { text: 'Captured instruction', truncated: false }, prompt: { text: 'Captured original task', truncated: false }, simulated: false };
    f.job.logs = ['PRIVATE operational diagnostic']; await flushPromises();
    const failure = f.wrapper.get('[aria-label="Recorded attempt failure"]');
    expect(failure.text()).toContain(providerFailureFor('authentication').summary);
    expect(failure.text()).toContain('Original execution is not confirmed stopped'); expect(failure.text()).toContain('Captured task available');
    expect(failure.text()).not.toContain('PRIVATE operational diagnostic');
    expect(f.wrapper.get('[aria-label="Session Peek"]').find('input,textarea').exists()).toBe(false);
    expect(f.wrapper.get('[aria-label="Session Peek"]').findAll('button').some(button => /Retry|Restart|Check original|Acknowledge/iu.test(button.text()))).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('opens only a host snapshot bound to the failed attempt and leaves its diff literal and unaccepted', async () => {
  const f = await fixture();
  try {
    f.job.workflow!.workspaceId = 'captured-workspace';
    const retained = { ...f.idea.increment!, summary: 'Exact failed-attempt partial changes', diff: '+<script>never execute</script>' };
    const artifact = { id: 'exact-snapshot', runId: f.run.id, stepId: 'build', attemptId: 'original-attempt', proposalRevision: f.run.proposalRevision,
      output: 'codechange' as const, createdAt: f.job.startedAt, hostSnapshot: true, summary: retained.summary, increment: retained, contentHash: '' };
    artifact.contentHash = workflowArtifactHash(artifact);
    f.run.artifacts.push({ ...artifact, id: 'foreign-snapshot', attemptId: 'different-attempt', summary: 'Different attempt changes', contentHash: '' }, artifact);
    await flushPromises();
    const failure = f.wrapper.get('[aria-label="Recorded attempt failure"]');
    expect(failure.text()).toContain('captured-workspace');
    await failure.findAll('button').find(button => button.text() === 'Read retained changes')!.trigger('click'); await flushPromises();
    const changes = f.wrapper.get('[data-job-id="original-job"] [aria-label="Retained changes for original attempt"]');
    expect(changes.text()).toContain(retained.summary); expect(changes.text()).not.toContain('Different attempt changes');
    expect(changes.get('[aria-label="Captured diff for original attempt"]').text()).toBe(retained.diff);
    expect(changes.find('script').exists()).toBe(false); expect(changes.text()).toContain('have not been accepted');
    expect(document.activeElement).toBe(changes.get('h4').element); expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
