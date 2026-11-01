// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import DurableBuildStatus from '../../../presentation/components/coforge/DurableBuildStatus.vue';
import WorkflowCapturedConfiguration from '../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue';
import type { AgentJob } from '../../../features/coforge/domain/types';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';
import { attemptFailureEvidence } from '../../../presentation/composables/coforge/attempt-failure-evidence';
import { providerFailureFor } from '../../../features/coforge/domain/provider-failure';
import { useWorkflow } from '../../../presentation/composables/coforge/use-workflow';
import ConfiguredWorkflowExecution from '../../../presentation/components/coforge/ConfiguredWorkflowExecution.vue';

async function fixture(managed = true) {
  const f = await workflowUiFixture(); const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  const step = { ...ai('build', 'codechange', 'editworktree'), name: 'Build', provider: 'claude' as const };
  const at = '2026-11-01T15:00:00Z';
  const run: WorkflowRun = { id: 'managed-run', ideaId: idea.id, projectId: f.project.id, definition: definition([step]), proposalRevision: 'proposal', revision: 1,
    cursor: 0, state: 'running', createdAt: at, updatedAt: at, activeAttemptId: 'attempt', artifacts: [], attempts: [
      { id: 'attempt', jobId: 'job', stepId: step.id, stepName: 'Build', kind: 'ai', status: 'running', inputs: [], startedAt: at }] };
  const job: AgentJob = { id: 'job', ideaId: idea.id, projectId: f.project.id, provider: 'claude', model: 'sonnet', stage: 'implement', status: 'running', startedAt: at, logs: [],
    workflow: { runId: run.id, attemptId: 'attempt', definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision, step, inputArtifacts: [],
      ...(managed ? { lifecycle: { version: 1, mode: 'managed-session' } } : {}) } };
  f.store.state!.ideas = [{ ...idea, workflowRun: run }]; f.store.state!.jobs = [job];
  return { ...f, idea, run, job };
}

it('shows a working attached agent and opens its session without exposing worker setup or task limits', async () => {
  const f = await fixture();
  const wrapper = mount(DurableBuildStatus, { props: { ideaId: f.idea.id, runId: f.run.id }, global: { plugins: [f.pinia, f.provider] } });
  try {
    expect(wrapper.get('h3').text()).toBe('Agent working');
    expect(wrapper.text()).toContain('Quiet periods');
    expect(wrapper.text()).not.toContain('Legacy foreground');
    expect(wrapper.text()).not.toContain('Captured deadline');
    expect(wrapper.text()).not.toContain('resource bounds');
    await wrapper.get('[aria-label="Open this agent session"]').trigger('click');
    expect(f.store.selected).toBe(f.idea.id); expect(f.store.drawerTab).toBe('sessions');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
it('offers one Continue action during safe acknowledgement settling but keeps unknown ownership and explicit Stop blocked', async () => {
  const f = await fixture();
  const run = f.store.state!.ideas[0]!.workflowRun!; const job = f.store.state!.jobs[0]!;
  run.state = 'attention'; delete run.activeAttemptId; run.workspaceId = 'worktree'; run.attempts[0]!.status = 'failed';
  const step = run.definition.steps[0]!; if (step.kind !== 'ai') throw new Error('Missing AI fixture'); step.execution = { mode: 'background' };
  job.status = 'failed'; job.workflow!.workspaceId = 'worktree'; job.workflow!.step.execution = { mode: 'background' };
  const ref = { version: 1 as const, executionId: 'execution', workerId: 'worker', epoch: 1, inputHash: 'a'.repeat(64) };
  job.durable = { ref, policy: { mode: 'background' }, intent: 'start', appliedSequence: 2, acknowledged: false, snapshot: { version: 1, ref, sequence: 2, phase: 'failed',
    createdAt: job.startedAt, startedAt: job.startedAt, lastContactAt: job.startedAt, elapsedSeconds: 0, logs: [], workspaceId: 'worktree', workspaceCaptured: true } };
  f.store.activeProject!.allowImplementation = true; f.store.state!.runtime.cliAvailable = true;
  f.store.state!.runtime.durableBuild = { ready: true, message: 'Fixture worker ready' };
  let model: ReturnType<typeof useWorkflow> | undefined;
  const Probe = defineComponent({ setup() { model = useWorkflow(() => f.idea.id); return () => h(ConfiguredWorkflowExecution, { model: model! }); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    expect(model?.blocked).toBe('');
    expect(wrapper.findAll('button').filter(button => button.text() === 'Continue · Build')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('Retry Build in background');
    expect(wrapper.findAll('button').some(button => button.text() === 'Start a new workflow run')).toBe(false);
    job.workflow!.backgroundRetryId = 'earlier-reviewed-epoch'; await flushPromises();
    expect(wrapper.text()).toContain('Retry Build in background');
    expect(wrapper.findAll('button').some(button => button.text() === 'Continue · Build')).toBe(false);
    delete job.workflow!.backgroundRetryId; await flushPromises();
    job.durable.snapshot!.phase = 'attention'; await flushPromises();
    expect(wrapper.findAll('button').some(button => button.text() === 'Continue · Build')).toBe(false);
    job.durable.snapshot!.phase = 'failed'; f.store.state!.workflowStopHolds = [f.idea.id]; await flushPromises();
    expect(wrapper.findAll('button').some(button => button.text() === 'Continue · Build')).toBe(false);
    expect(wrapper.text()).toContain('This workflow is stopped'); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
it('points a managed provider-limit failure to the CLI account while retaining its original captured catalogue text', async () => {
  const f = await fixture();
  try {
    const original = providerFailureFor('budget_limit');
    f.store.state!.jobs = [{ ...f.job, status: 'failed', failure: original }];
    const evidence = attemptFailureEvidence(f.store.state, f.job.id);
    expect(evidence?.summary).toContain('CLI or provider');
    expect(evidence?.nextStep).toContain('account');
    expect(evidence?.nextStep).not.toContain('workflow budget settings');
    expect(evidence?.failure).toEqual(original);
    expect(f.store.state!.jobs[0]?.failure).toEqual(original);
  } finally { await f.dispose(); }
});
it('uses Continue for an earlier timed-out native task without changing its captured lifecycle or limits', async () => {
  const f = await fixture(false);
  const run = f.store.state!.ideas[0]!.workflowRun!; const job = f.store.state!.jobs[0]!;
  run.state = 'attention'; delete run.activeAttemptId; run.attempts[0]!.status = 'failed'; job.status = 'failed';
  f.store.activeProject!.allowImplementation = true; f.store.state!.runtime.cliAvailable = true;
  const before = JSON.stringify(job.workflow); const limits = JSON.stringify(run.definition.limits);
  const Probe = defineComponent({ setup() { const model = useWorkflow(() => f.idea.id); return () => h(ConfiguredWorkflowExecution, { model }); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    expect(wrapper.findAll('button').filter(button => button.text() === 'Continue · Build')).toHaveLength(1);
    expect(JSON.stringify(job.workflow)).toBe(before); expect(JSON.stringify(run.definition.limits)).toBe(limits);
    expect(job.workflow?.lifecycle).toBeUndefined(); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('labels a managed captured session independently of obsolete saved numeric limits and keeps legacy history distinct', async () => {
  const f = await fixture();
  const wrapper = mount(WorkflowCapturedConfiguration, { props: { run: f.run }, global: { plugins: [f.pinia, f.provider] } });
  try {
    const sessions = wrapper.get('[aria-label="Captured managed agent sessions"]');
    expect(sessions.text()).toContain('Build'); expect(sessions.text()).toContain('completion');
    expect(wrapper.find('[aria-label="Captured execution policies"]').exists()).toBe(false);
    f.store.state!.jobs = [{ ...f.job, workflow: { ...f.job.workflow!, lifecycle: undefined } }]; await flushPromises();
    expect(wrapper.find('[aria-label="Captured managed agent sessions"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="Captured execution policies"]').text()).toContain('timeout');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
