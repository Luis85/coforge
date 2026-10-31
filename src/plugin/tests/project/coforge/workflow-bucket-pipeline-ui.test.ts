// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import PipelineStrip from '../../../presentation/components/coforge/PipelineStrip.vue';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { materializeWorkflowBuckets } from '../../../features/coforge/domain/workflow-buckets';
import { workflowUiFixture } from './workflow-ui-fixture';

it('shows saved project buckets as the main process and labels Accepted as an outcome without dispatch', async () => {
  const f = await workflowUiFixture();
  const definition = materializeWorkflowBuckets(defaultWorkflowDefinition(f.project.settings));
  definition.buckets![1]!.name = 'Explore the opportunity';
  definition.buckets![4]!.name = 'Approved changes';
  f.store.activeProject!.settings.workflow = definition;
  const wrapper = mount(PipelineStrip, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const writes = f.storage.saves;
    const stages = wrapper.findAll('.cf-pipeline-stage');
    expect(stages.map(stage => stage.attributes('data-bucket-id'))).toEqual(['inbox', 'next', 'design', 'progress', 'done']);
    expect(stages.map(stage => stage.get('.cf-pipeline-stage-label').text())).toEqual(['Inbox', 'Explore the opportunity', 'Design', 'In progress', 'Approved changes']);
    expect(stages.at(-1)!.classes()).toContain('is-outcome');
    expect(stages.at(-1)!.attributes('title')).toContain('outcome');
    expect(stages.at(-1)!.find('.cf-pipeline-stage-number').exists()).toBe(false);
    expect(wrapper.text()).toContain('Your review');
    expect(wrapper.find('[aria-label="Start automation"]').exists()).toBe(true);
    expect(f.runner).not.toHaveBeenCalled();
    expect(f.storage.saves).toBe(writes);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('highlights only a current captured job bucket and ignores old revisions, unknown assignments and other projects', async () => {
  const f = await workflowUiFixture();
  const definition = materializeWorkflowBuckets(defaultWorkflowDefinition(f.project.settings));
  f.store.activeProject!.settings.workflow = definition;
  const step = definition.steps.find(item => item.id === 'plan')!;
  if (step.kind !== 'ai') throw new Error('Expected AI fixture');
  f.store.state!.jobs.push({ id: 'active', ideaId: 'CF-999', projectId: f.project.id, stage: 'plan', provider: 'demo',
    status: 'running', startedAt: new Date().toISOString(), logs: [], workflow: { runId: 'run', definitionRevision: definition.revision,
      proposalRevision: 'proposal', attemptId: 'attempt', step: structuredClone(step), inputArtifacts: [] } });
  const wrapper = mount(PipelineStrip, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.findAll('.is-working').map(stage => stage.attributes('data-bucket-id'))).toEqual(['next']);
    const job = f.store.state!.jobs.at(-1)!;
    job.workflow!.definitionRevision = 'older-revision';
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.is-working')).toHaveLength(0);
    job.workflow!.definitionRevision = definition.revision;
    job.workflow!.step.bucketId = 'inbox';
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.is-working')).toHaveLength(0);
    job.workflow!.step.bucketId = 'next';
    job.projectId = 'CFP-999';
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.is-working')).toHaveLength(0);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps the existing flat process for legacy definitions and does not highlight an unrelated captured revision', async () => {
  const f = await workflowUiFixture();
  const definition = defaultWorkflowDefinition(f.project.settings);
  const step = definition.steps[0]!;
  if (step.kind !== 'ai') throw new Error('Expected AI fixture');
  f.store.state!.jobs.push({ id: 'old-job', ideaId: 'CF-999', projectId: f.project.id, stage: 'screen', provider: 'demo',
    status: 'running', startedAt: new Date().toISOString(), logs: [], workflow: { runId: 'old-run', definitionRevision: 'old-revision',
      proposalRevision: 'proposal', attemptId: 'attempt', step, inputArtifacts: [] } });
  const wrapper = mount(PipelineStrip, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.findAll('.cf-pipeline-stage').map(stage => stage.get('.cf-pipeline-stage-label').text())).toEqual(['Screen', 'Score', 'Plan', 'Design', 'Build']);
    expect(wrapper.findAll('[data-bucket-id]')).toHaveLength(0);
    expect(wrapper.findAll('.is-working')).toHaveLength(0);
    expect(wrapper.text()).toContain('Your review');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
