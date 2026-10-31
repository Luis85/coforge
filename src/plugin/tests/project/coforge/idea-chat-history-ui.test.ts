// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import type { AgentJob } from '../../../features/coforge/domain/types';
import { createSeed } from '../../../features/coforge/domain/seed';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { workflowUiFixture } from './workflow-ui-fixture';

const at = '2026-10-31T12:00:00.000Z';
const conversation = (simulated = false) => ({
  capturedAt: at, instructions: { text: 'Captured original instructions', truncated: false },
  prompt: { text: 'Original question\n<script>never execute()</script>', truncated: false },
  response: { text: 'Original response\n<img src=x onerror=execute()>', truncated: false },
  responseCapturedAt: '2026-10-31T12:01:00.000Z', simulated,
});

async function fixture(jobs: AgentJob[]) {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  if (!f.store.state) throw new Error('Missing state');
  f.store.state.ideas = [idea];
  f.store.state.jobs = jobs.map(job => ({ ...job, ideaId: idea.id, projectId: f.project.id }));
  f.store.select(idea.id, 'activity');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  return { ...f, wrapper, close: async () => { wrapper.unmount(); await f.dispose(); } };
}

function job(id: string, status: AgentJob['status'] = 'succeeded'): AgentJob {
  return { id, ideaId: 'pending', stage: 'screen', provider: 'claude', model: 'captured-model', status, startedAt: at, logs: ['Diagnostic log only'] };
}

it('reads captured prompts and answers in the matching attempt without sending, writing or interpreting HTML', async () => {
  const f = await fixture([
    Object.assign(job('first'), { conversation: conversation() }),
    Object.assign(job('retry'), { conversation: { ...conversation(), prompt: { text: 'Retry question', truncated: false } } }),
    { ...job('foreign'), ideaId: 'CF-999' },
  ]);
  try {
    // Keep a different request's job outside the selected request projection.
    f.store.state!.jobs[2]!.ideaId = 'CF-999';
    await f.wrapper.vm.$nextTick();
    const writes = f.storage.saves;
    const runs = f.wrapper.findAll('.cf-idea-run');
    expect(runs).toHaveLength(2);
    expect(runs[0]!.attributes('data-job-id')).toBe('retry');
    const first = f.wrapper.get('[data-job-id="first"]');
    expect(first.get('summary').text()).toContain('captured-model');
    expect(first.get('summary').text()).toContain('Chat history');
    expect(first.get('[aria-label="Chat history"]').text()).toContain('Captured prompt');
    expect(first.get('[aria-label="Chat history"]').text()).toContain('capture alone does not confirm delivery');
    expect(first.get('[aria-label="Chat history"]').text()).toContain('LLM response');
    expect(first.get('[aria-label="Chat history"]').text()).toContain('Recognizable credentials in Claude response captures are redacted.');
    expect(first.findAll('.cf-idea-transcript').map(node => node.text())).toEqual([
      conversation().prompt.text, conversation().response.text, conversation().instructions.text,
    ]);
    expect(first.find('script').exists()).toBe(false);
    expect(first.find('img').exists()).toBe(false);
    expect(first.findAll('.cf-idea-evidence summary').map(node => node.text())).toEqual(['System instructions', 'Execution log']);
    expect(first.findAll('time').map(node => node.attributes('datetime'))).toContain(at);
    f.store.state!.projects![0]!.settings.agentPrompt = 'New instructions are not past evidence';
    f.store.state!.ideas[0]!.description = 'Edited current request';
    await f.wrapper.vm.$nextTick();
    expect(first.text()).toContain('Captured original instructions');
    expect(first.text()).not.toContain('New instructions are not past evidence');
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('distinguishes old history, queued input, missing output, simulation and truncated captures', async () => {
  const waiting = conversation();
  const inputOnly = { capturedAt: waiting.capturedAt, instructions: waiting.instructions, prompt: waiting.prompt, simulated: waiting.simulated };
  const f = await fixture([
    job('legacy'), job('queued', 'queued'),
    Object.assign(job('running', 'running'), { conversation: inputOnly }),
    Object.assign(job('failed', 'failed'), { conversation: inputOnly, error: 'Provider stopped' }),
    Object.assign({ ...job('demo'), provider: 'demo' as const }, { conversation: { ...conversation(true), prompt: { text: 'Bounded input', truncated: true }, response: { text: 'Bounded answer', truncated: true } } }),
  ]);
  try {
    expect(f.wrapper.get('[data-job-id="legacy"]').text()).toContain('Chat history was not recorded for this run.');
    expect(f.wrapper.get('[data-job-id="queued"]').text()).toContain('No prompt has been sent yet.');
    expect(f.wrapper.get('[data-job-id="running"]').text()).toContain('No response recorded yet.');
    expect(f.wrapper.get('[data-job-id="failed"]').text()).toContain('No response was recorded before this run failed.');
    const demo = f.wrapper.get('[data-job-id="demo"]');
    expect(demo.get('summary').text()).toContain('Simulation');
    expect(demo.text()).toContain('Simulated input');
    expect(demo.text()).toContain('Simulated response');
    expect(demo.text()).toContain('No LLM was contacted.');
    expect(demo.text()).not.toContain('Recognizable credentials');
    expect(demo.findAll('.cf-idea-truncation')).toHaveLength(2);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('describes externally supplied context and submitted results without inventing an external conversation or model', async () => {
  const f = await fixture([Object.assign({ ...job('external'), provider: 'mcp' as const, model: undefined }, { conversation: conversation() })]);
  try {
    const history = f.wrapper.get('[role="region"][aria-label="Chat history"]');
    expect(history.text()).toContain('Task context');
    expect(history.text()).toContain('Submitted response');
    expect(history.text()).toContain("The external app's conversation is unavailable.");
    expect(history.text()).not.toContain('Prompt sent');
    expect(history.text()).not.toContain('LLM response');
    expect(f.wrapper.get('.cf-idea-run > summary').text()).not.toContain('Model not recorded');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('attributes Codex history to its captured model and effort after current settings and prompts change', async () => {
  const captured: AgentJob = { ...job('codex'), provider: 'codex', model: 'gpt-6.1-sol', conversation: conversation(),
    workflow: { runId: 'captured-run', definitionRevision: 'revision', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [],
      step: { id: 'analysis', name: 'Captured analysis', kind: 'ai', provider: 'codex', model: 'gpt-6.1-sol', effort: 'high', access: 'none', output: 'markdown', automatic: false, instructions: 'Captured original instructions' } },
  };
  const f = await fixture([captured]);
  try {
    const summary = f.wrapper.get('[data-job-id="codex"] > summary');
    expect(summary.text()).toContain('codex');
    expect(summary.text()).toContain('gpt-6.1-sol');
    expect(summary.text()).toContain('high effort');
    expect(f.wrapper.get('[aria-label="Chat history"]').text()).toContain('Recognizable credentials in Codex response captures are redacted.');
    expect(f.wrapper.get('[data-job-id="codex"]').findAll('.cf-idea-transcript')[1]!.text()).toBe(conversation().response.text);
    expect(f.wrapper.find('img').exists()).toBe(false);
    f.store.state!.projects![0]!.settings.agentPrompt = 'Changed current instructions';
    f.store.state!.projects![0]!.settings.model = 'new-model';
    f.store.state!.projects![0]!.settings.stageAgents = { screen: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'low' } };
    await f.wrapper.vm.$nextTick();
    expect(summary.text()).toContain('high effort');
    expect(summary.text()).not.toContain('low effort');
    expect(summary.text()).not.toContain('new-model');
    delete f.store.state!.jobs[0]!.workflow!.step.effort;
    await f.wrapper.vm.$nextTick();
    expect(summary.text()).not.toContain('effort');
    f.store.state!.jobs[0]!.workflow!.step.effort = 'high';
    f.store.state!.jobs[0]!.provider = 'mcp';
    await f.wrapper.vm.$nextTick();
    expect(summary.text()).not.toContain('high effort');
    f.store.state!.jobs[0]!.provider = 'demo';
    await f.wrapper.vm.$nextTick();
    expect(summary.text()).not.toContain('high effort');
    expect(f.wrapper.text()).toContain('Captured original instructions');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
