// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import { toRaw } from 'vue';
import DurableBuildStatus from '../../../presentation/components/coforge/DurableBuildStatus.vue';
import type { AgentJob } from '../../../features/coforge/domain/types';
import type { PolishingRun } from '../../../features/coforge/domain/polishing';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import { retryUiFixture } from './background-build-retry-ui-fixture';

it('checks, inspects and recovers only the exact auxiliary worker and leaves the primary checkpoint untouched', async () => {
  const f = await retryUiFixture(); f.idea.increment = f.preview.inspection.increment!;
  const original = JSON.stringify(f.run); const at = new Date().toISOString();
  const step = { ...f.preview.step, execution: f.preview.policy };
  const ref = { version: 1 as const, executionId: 'aux-execution', workerId: 'worker', epoch: 1, inputHash: 'a'.repeat(64) };
  const snapshot = { version: 1 as const, ref, sequence: 3, phase: 'attention' as const, createdAt: at, lastContactAt: at,
    elapsedSeconds: 100, logs: ['Retained auxiliary evidence'], cancellationRequested: true, workspaceCaptured: true };
  const job: AgentJob = { id: 'aux-job', ideaId: f.idea.id, projectId: f.project.id, stage: 'implement', provider: 'claude', model: 'sonnet', status: 'running', startedAt: at, logs: [],
    workflow: { runId: 'aux-run', attemptId: 'aux-attempt', definitionRevision: f.run.definition.revision, proposalRevision: f.run.proposalRevision, step, inputArtifacts: [] },
    durable: { intent: 'cancel', policy: f.preview.policy, ref, snapshot, reconcileError: 'Original auxiliary worker could not be reached.' } };
  const target = selectPolishingTarget(toRaw(f.idea));
  const pass: PolishingRun = { id: 'aux-run', feedback: 'Polish the actual code.', target, sourceHash: target.contentHash, consent: { oldExecutorStopped: true, changesReviewed: true, releaseStopHold: false },
    previousStatus: f.idea.status, sourceArtifacts: [], policySourceRevision: 'pass-policy', createdAt: at, review: 'pending',
    workflow: { id: 'aux-run', ideaId: f.idea.id, projectId: f.project.id, definition: { ...f.run.definition, steps: [step] }, proposalRevision: f.run.proposalRevision,
      revision: 3, cursor: 0, state: 'attention', createdAt: at, updatedAt: at, activeAttemptId: 'aux-attempt', artifacts: [],
      attempts: [{ id: 'aux-attempt', stepId: step.id, stepName: step.name, kind: 'ai', status: 'running', inputs: [], startedAt: at, jobId: job.id }] } };
  f.idea.polishingRuns = [pass]; f.store.state!.jobs = [job];
  const check = vi.spyOn(f.studio, 'reconcileDurableBuild').mockResolvedValue();
  const inspect = vi.spyOn(f.studio, 'inspectDurableBuildEvidence').mockImplementation(async () => {
    const receipt = { version: 1 as const, ref, snapshot, evidenceHash: 'b'.repeat(64), observedAt: at, ideaId: f.idea.id, runId: pass.id, runRevision: 3 };
    f.store.state!.runtime.durableBuildInspections = { [job.id]: receipt }; return receipt;
  });
  const recover = vi.spyOn(f.studio, 'recoverDurableBuild').mockResolvedValue();
  const wrapper = mount(DurableBuildStatus, { props: { ideaId: f.idea.id, runId: pass.id }, global: { plugins: [f.pinia, f.provider] } });
  const button = (name: string) => wrapper.findAll('button').find(item => item.text() === name)!;
  try {
    await button('Check existing Build').trigger('click'); await flushPromises();
    expect(check).toHaveBeenCalledExactlyOnceWith(f.idea.id, pass.id);
    await button('Inspect retained Build evidence').trigger('click'); await flushPromises();
    expect(inspect).toHaveBeenCalledExactlyOnceWith(f.idea.id, 3, pass.id);
    await wrapper.get('[aria-label="I reviewed the retained Build evidence"]').setValue(true);
    await button('Verify and recover interrupted Build').trigger('click'); await flushPromises();
    expect(recover).toHaveBeenCalledExactlyOnceWith(f.idea.id, 3, true, pass.id);
    expect(JSON.stringify(f.run)).toBe(original); expect(f.runner).not.toHaveBeenCalled();
    await wrapper.setProps({ runId: f.run.id });
    expect(wrapper.find('[aria-label="Background Build status"]').exists()).toBe(false);
  } finally { wrapper.unmount(); await f.dispose(); }
});
