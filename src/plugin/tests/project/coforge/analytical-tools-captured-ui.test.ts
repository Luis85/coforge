// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowCapturedConfiguration from '../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue';
import type { AgentJob } from '../../../features/coforge/domain/types';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

it('separates admitted analytical tools from saved options without granting defaults to a historical attempt', async () => {
  const f = await workflowUiFixture(); const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  const step = { ...ai('plan', 'markdown', 'readproject'), name: 'Refinement', provider: 'claude' as const };
  const at = '2026-11-02T09:30:00Z';
  const run: WorkflowRun = { id: 'analysis-run', ideaId: idea.id, projectId: f.project.id, definition: definition([{ ...step, nativeTools: { delegation: { maxConcurrent: 6 } } }]),
    proposalRevision: 'proposal', revision: 1, cursor: 1, state: 'finished', createdAt: at, updatedAt: at, artifacts: [],
    attempts: ['earlier', 'current', 'disabled'].map(id => ({ id, jobId: `${id}-job`, stepId: step.id, stepName: step.name, kind: 'ai', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at })) };
  const jobs: AgentJob[] = ['earlier', 'current', 'disabled'].map(id => ({ id: `${id}-job`, ideaId: idea.id, projectId: f.project.id, provider: 'claude', model: 'sonnet', stage: 'plan',
    status: 'succeeded', startedAt: at, finishedAt: at, logs: [], workflow: { runId: run.id, attemptId: id, definitionRevision: run.definition.revision,
      proposalRevision: run.proposalRevision, lifecycle: { version: 1, mode: 'managed-session' }, step: { ...step }, inputArtifacts: [] } }));
  jobs[1]!.workflow!.analyticalTools = { version: 1, profile: 'scoped-analyst-v1' };
  jobs[1]!.workflow!.step.nativeTools = { delegation: { maxConcurrent: 2 }, research: true };
  jobs[2]!.workflow!.analyticalTools = { version: 1, profile: 'scoped-analyst-v1' };
  jobs[2]!.workflow!.step.nativeTools = { delegation: false, research: false };
  f.store.state!.ideas = [{ ...idea, workflowRun: run }]; f.store.state!.jobs = jobs;
  const before = JSON.stringify({ run, jobs });
  const wrapper = mount(WorkflowCapturedConfiguration, { props: { run }, global: { plugins: [f.pinia, f.provider], stubs: { MarkdownBody: true } } });
  try {
    const earlier = wrapper.get('[data-analytical-attempt="earlier"]');
    expect(earlier.text()).toContain('Earlier restricted attempt');
    expect(earlier.text()).toContain('No native assistant grant recorded');
    expect(earlier.text()).toContain('No native research grant recorded');
    expect(earlier.text()).not.toContain('2 concurrent');
    const current = wrapper.get('[data-analytical-attempt="current"]');
    expect(current.text()).toContain('2 concurrent'); expect(current.text()).toContain('Native web research allowed');
    expect(current.text()).not.toContain('6 concurrent');
    const disabled = wrapper.get('[data-analytical-attempt="disabled"]');
    expect(disabled.text()).toContain('Native assistants disabled'); expect(disabled.text()).toContain('Native web research disabled');
    expect(wrapper.get('[aria-label="Captured analytical tools"]').text()).toContain('Sessions');
    expect(JSON.stringify({ run, jobs })).toBe(before); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
