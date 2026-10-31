import { afterEach, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { AgentTaskNotStartedError, type AgentTaskRequest, type AgentTaskResult } from '../../../features/coforge/application/agent-task';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition, workflowDefinitionCheck, type CouncilWorkflowStep } from '../../../features/coforge/domain/configured-workflow';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { testCouncilBinding } from './workflow-council-test-binding';
import { contextEventId } from '../../../features/coforge/domain/integrity';
import { record } from '../../../features/coforge/domain/check';
import { councilWorkflowInputs } from '../../../features/coforge/application/workflow-council-context';
import { captureRequestObject, REQUEST_OBJECT_FORMAT } from '../../../features/coforge/domain/request-object';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture(options: { contextMode?: CouncilWorkflowStep['contextMode']; earlierResult?: boolean; earlierCode?: boolean; admissionWait?(): Promise<void>; afterAdmission?(storage: MemoryStorage): void; beforeAdmission?(input: AgentTaskRequest): void; bindingIdentity?(): string; cancel?(id: string): Promise<void> } = {}) {
  const state = createSeed(); state.settings.paused = true;
  state.settings.workflow = workflowDefinitionCheck({ ...defaultWorkflowDefinition(state.settings), revision: 'council-reliability', steps: [
    ...(options.earlierResult ? [{ id: 'earlier', kind: 'ai', name: 'Earlier analysis', instructions: 'Private analysis.', output: 'markdown', access: 'none', provider: 'demo', model: 'sonnet', automatic: false }] : []),
    ...(options.earlierCode ? [{ id: 'code', kind: 'ai', name: 'Earlier code', instructions: 'Simulated code.', output: 'codechange', access: 'editworktree', provider: 'demo', model: 'sonnet', automatic: false }] : []),
    { id: 'ask', kind: 'council', name: 'Ask Council', instructions: 'Compare the options.', councilId: 'advice', automatic: false, inputs: options.contextMode === 'selected' ? ['markdown'] : [], ...(options.contextMode ? { contextMode: options.contextMode } : {}) },
    { id: 'approve', kind: 'approval', name: 'Review advice', instructions: 'Read the complete advice.' },
  ] });
  const storage = new MemoryStorage(state); const calls: AgentTaskRequest[] = [];
  let result: AgentTaskResult = { state: 'pending' };
  const binding = (projectId: string, councilId: string) => testCouncilBinding(projectId, councilId, contextEventId(JSON.stringify([options.bindingIdentity?.() ?? 'original', studio.state().settings.agentPrompt])));
  const studio: StudioService = new StudioService(storage, { timers: nodeTimers(), runners: { demo: async () => options.earlierCode ? { summary: 'Retained simulated code.', increment: { summary: 'Retained simulated code.', files: [{ path: 'game.ts', additions: 1, deletions: 0 }], tests: [], diff: '+ simulated change', simulated: true, createdAt: new Date().toISOString() } } : { markdown: 'Earlier private analysis.' }, claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: true, projectPath: null, allowImplementation: false }),
    agentTasks: { prepareCouncil: async (projectId, councilId) => binding(projectId, councilId), create: async input => { if (input.councilBinding?.identity !== binding(input.projectId, input.councilId ?? '').identity) throw new AgentTaskNotStartedError('Captured Council setup changed.'); options.beforeAdmission?.(input); calls.push(input); await options.admissionWait?.(); options.afterAdmission?.(storage); return { runId: 'confirmed-child', sourcePath: input.sourcePath, sourceId: 'confirmed-source' }; }, result: async () => result, cancel: options.cancel ?? (async () => {}) },
  });
  await studio.start(); cleanups.push(() => studio.stop());
  const id = studio.state().ideas.find(idea => idea.status === 'inbox')!.id;
  return { studio, storage, calls, id, current: () => studio.state().ideas.find(idea => idea.id === id)!.workflowRun!, answer: () => { result = { state: 'completed', projectId: 'CFP-001', sourcePath: calls[0]!.sourcePath, sourceId: 'confirmed-source', markdown: 'Published advice.' }; } };
}

it('retains the confirmed child when the first receipt write fails and never asks to replay admission', async () => {
  const f = await fixture({ afterAdmission: storage => { storage.failNextSave = true; } });
  const run = await f.studio.startWorkflow(f.id);
  expect(run.attempts[0]).toMatchObject({ nudgeRunId: 'confirmed-child', councilSourceId: 'confirmed-source', nudgeState: 'submitted' });
  expect(run.activeAttemptId).toBe(run.attempts[0]!.id);
  expect(run.state).toBe('attention');
  f.answer(); await f.studio.runWorkflowStep(f.id);
  expect(f.current().cursor).toBe(1); expect(f.calls).toHaveLength(1);
});

it('retains a confirmed child across two receipt-save failures before a later recovery write', async () => {
  const f = await fixture({ afterAdmission: storage => {
    const write = storage.save.bind(storage); let remaining = 2;
    vi.spyOn(storage, 'save').mockImplementation(async state => { if (remaining-- > 0) throw new Error('Receipt persistence failed'); await write(state); });
  } });
  const run = await f.studio.startWorkflow(f.id);
  expect(run.attempts[0]).toMatchObject({ nudgeRunId: 'confirmed-child', councilSourceId: 'confirmed-source', nudgeState: 'submitted' });
  expect(run.activeAttemptId).toBe(run.attempts[0]!.id);
  await expect(f.studio.startWorkflow(f.id)).rejects.toThrow('Inspect or stop');
  f.answer(); await f.studio.runWorkflowStep(f.id);
  expect(f.current().cursor).toBe(1); expect(f.calls).toHaveLength(1);
});

it('cannot replay a known admission even when all immediate receipt writes fail', async () => {
  const f = await fixture({ afterAdmission: storage => {
    const write = storage.save.bind(storage); let remaining = 3;
    vi.spyOn(storage, 'save').mockImplementation(async state => { if (remaining-- > 0) throw new Error('Receipt persistence failed'); await write(state); });
  } });
  await expect(f.studio.startWorkflow(f.id)).rejects.toThrow('Receipt persistence failed');
  await expect(f.studio.runWorkflowStep(f.id)).rejects.toThrow('current state');
  await expect(f.studio.startWorkflow(f.id)).rejects.toThrow('Finish, stop or review');
  expect(f.calls).toHaveLength(1);
  await f.studio.stopWorkflow(f.id);
  expect(f.current()).toMatchObject({ state: 'stopped', attempts: [{ nudgeRunId: 'confirmed-child', councilSourceId: 'confirmed-source', councilCancellation: 'confirmed' }] });
});

it('does not replay cancellation when an unknown outcome marker cannot be saved', async () => {
  let release = () => {}; const admitted = new Promise<void>(resolve => { release = resolve; });
  const cancel = vi.fn(async () => { throw new Error('Cancellation outcome unknown'); });
  const f = await fixture({ admissionWait: async () => admitted, cancel });
  const starting = f.studio.startWorkflow(f.id);
  try {
    await vi.waitFor(() => expect(f.calls).toHaveLength(1));
    await f.studio.stopWorkflow(f.id);
    const write = f.storage.save.bind(f.storage); let failOutcome = true;
    vi.spyOn(f.storage, 'save').mockImplementation(async state => {
      const attempt = state.ideas.find(item => item.id === f.id)?.workflowRun?.attempts[0];
      if (failOutcome && attempt?.councilCancellation === 'unknown') { failOutcome = false; throw new Error('Cancellation marker failed'); }
      await write(state);
    });
    release(); await starting;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(f.current()).toMatchObject({ state: 'stopped', attempts: [{ nudgeRunId: 'confirmed-child', councilCancellation: 'unknown' }] });
    await expect(f.studio.startWorkflow(f.id)).rejects.toThrow('Restart workflow');
    await expect(f.studio.restartWorkflowFromOperator(f.id)).rejects.toThrow('acknowledge');
    expect(f.calls).toHaveLength(1);
  } finally { release(); await starting.catch(() => undefined); }
});

it('commits stop before awaiting cancellation and prevents a concurrent handoff', async () => {
  let release = () => {};
  const cancelled = new Promise<void>(resolve => { release = resolve; });
  const f = await fixture({ cancel: async () => cancelled });
  await f.studio.startWorkflow(f.id); f.answer();
  const stopping = f.studio.stopWorkflow(f.id);
  try {
    await vi.waitFor(() => expect(f.current().state).toBe('stopped'));
    await expect(f.studio.runWorkflowStep(f.id)).rejects.toThrow('Restart workflow');
    await expect(f.studio.restartWorkflowFromOperator(f.id)).rejects.toThrow('cancellation');
    expect(f.current().artifacts).toHaveLength(0);
    expect(f.current().cursor).toBe(0);
  } finally { release(); await stopping; }
});

it('retains a known child and requires inspection if cancellation cannot be confirmed', async () => {
  const f = await fixture({ cancel: async () => { throw new Error('Cancel outcome unknown'); } });
  await f.studio.startWorkflow(f.id);
  await f.studio.stopWorkflow(f.id).catch(() => undefined);
  expect(f.current()).toMatchObject({ state: 'stopped', attempts: [{ nudgeRunId: 'confirmed-child', councilSourceId: 'confirmed-source', councilCancellation: 'unknown' }] });
  await expect(f.studio.startWorkflow(f.id)).rejects.toThrow('Restart workflow');
  await expect(f.studio.restartWorkflowFromOperator(f.id)).rejects.toThrow('acknowledge');
  expect(f.calls).toHaveLength(1);
});

it.each(['awaiting-review', 'finished'] as const)('acknowledges cancellation metadata in %s without reopening work or bypassing code review', async phase => {
  const f = await fixture({ earlierCode: true, cancel: async () => { throw new Error('Cancellation outcome unknown'); } });
  await f.studio.startWorkflow(f.id); await vi.waitFor(() => expect(f.current().cursor).toBe(1));
  await f.studio.runWorkflowStep(f.id); await f.studio.stopWorkflow(f.id).catch(() => undefined);
  expect(f.current().state).toBe('awaiting-review');
  if (phase === 'finished') await f.studio.act(f.id, 'approve', 'Explicit human review of the simulated fixture.');
  const before = f.current();
  await f.studio.acknowledgeWorkflowNudge(f.id, before.revision, true);
  expect(f.current().state).toBe(phase);
  expect(f.current().attempts.find(attempt => attempt.kind === 'council')).toMatchObject({ nudgeRunId: 'confirmed-child', councilCancellation: 'unknown', nudgeAcknowledgedAt: expect.any(String) });
  const idea = f.studio.state().ideas.find(item => item.id === f.id)!;
  expect(idea.increment?.files).toEqual([{ path: 'game.ts', additions: 1, deletions: 0 }]);
  expect(idea.status).toBe(phase === 'finished' ? 'shipped' : 'inbox');
  expect(f.studio.state().workflowStopHolds).toContain(f.id);
  await expect(f.studio.runWorkflowStep(f.id)).rejects.toThrow();
  expect(f.calls).toHaveLength(1);
});

it('repairs a known not-started prerequisite without duplicate-risk acknowledgement', async () => {
  let ready = false;
  const f = await fixture({ beforeAdmission: () => { if (!ready) throw new AgentTaskNotStartedError('Choose the execution desktop.'); } });
  const first = await f.studio.startWorkflow(f.id);
  expect(first).toMatchObject({ state: 'attention', error: expect.stringContaining('not started') });
  expect(first.attempts[0]?.nudgeState).toBeUndefined(); expect(f.calls).toHaveLength(0);
  ready = true; await f.studio.runWorkflowStep(f.id);
  expect(f.current().attempts.at(-1)).toMatchObject({ nudgeRunId: 'confirmed-child', nudgeState: 'submitted' });
  expect(f.calls).toHaveLength(1);
});

it.each(['definitions', 'project prompt'] as const)('holds captured %s changes instead of silently changing an existing workflow', async change => {
  let version = 'original'; let ready = false;
  const f = await fixture({ bindingIdentity: () => version, beforeAdmission: () => { if (!ready) throw new AgentTaskNotStartedError('Execution not ready.'); } });
  const first = await f.studio.startWorkflow(f.id);
  expect(first.councilBindings?.[0]?.binding.councilName).toBe('Advice Council');
  if (change === 'definitions') version = 'changed'; else {
    await expect(f.studio.updateSettings({ agentPrompt: 'A later project prompt.' })).rejects.toThrow('Finish, stop or review');
    await f.studio.store.transaction(state => { state.settings.agentPrompt = 'An external project prompt edit.'; state.projects.find(project => project.id === state.activeProjectId)!.settings.agentPrompt = state.settings.agentPrompt; });
  }
  ready = true; await f.studio.runWorkflowStep(f.id);
  expect(f.calls).toHaveLength(0);
  expect(f.current()).toMatchObject({ state: 'attention', error: expect.stringContaining('Captured Council setup changed') });
  expect(f.current().councilBindings).toEqual(first.councilBindings);
});

it.each([undefined, 'all', 'selected', 'none'] as const)('captures exact earlier-result context for mode %s, including legacy absence', async mode => {
  const f = await fixture({ earlierResult: true, contextMode: mode });
  await f.studio.startWorkflow(f.id);
  await vi.waitFor(() => expect(f.current().cursor).toBe(1));
  await f.studio.runWorkflowStep(f.id);
  const context = record(JSON.parse(f.calls[0]!.context));
  expect(context.boundArtifacts).toHaveLength(mode === 'none' ? 0 : 1);
  if (mode !== 'none') expect(context.boundArtifacts).toEqual([expect.objectContaining({ markdown: 'Earlier private analysis.' })]);
});

it('includes canonical request inputs with no earlier results while excluding derived workflow outputs', async () => {
  const f = await fixture({ earlierCode: true, contextMode: 'none' });
  const at = new Date().toISOString();
  await f.studio.store.transaction(state => {
    const idea = state.ideas.find(item => item.id === f.id)!;
    idea.category = 'Tools'; idea.requestKind = 'bug';
    idea.requestObject = captureRequestObject({ format: REQUEST_OBJECT_FORMAT, className: 'Game request', fields: [{ key: 'targetPlatform', label: 'Target platform', type: 'text' }], categories: ['Tools'] }, { targetPlatform: 'desktop' });
    idea.contexts = [{ id: 'context-one', authorId: 'private-viewer-id', authorName: 'Viewer One', text: 'Please support keyboard-only play.', createdAt: at }];
    idea.screening = { verdict: 'clear', reason: 'Derived screening result.', signals: [], provider: 'demo', checkedAt: at };
    idea.rice = { reach: 42, impact: 1, confidence: 0.8, effort: 2, score: 16.8, rationale: 'Derived prioritization.' };
    idea.plan = { summary: 'Derived plan.', steps: ['A planned step.'], acceptanceCriteria: ['A planned criterion.'], risks: [], markdown: '# Derived plan', createdAt: at };
  });
  await f.studio.startWorkflow(f.id); await vi.waitFor(() => expect(f.current().cursor).toBe(1));
  await f.studio.runWorkflowStep(f.id);
  const context = record(JSON.parse(f.calls[0]!.context)); const subject = record(context.untrustedRequest);
  expect(subject).toMatchObject({ id: f.id, projectId: 'CFP-001', category: 'Tools', requestKind: 'bug', requestObject: { className: 'Game request', values: { targetPlatform: 'desktop' } } });
  expect(subject.contexts).toEqual([{ authorName: 'Viewer One', text: 'Please support keyboard-only play.', createdAt: at }]);
  expect(context.boundArtifacts).toEqual([]);
  for (const field of ['screening', 'rice', 'plan', 'increment']) expect(subject).not.toHaveProperty(field);
  expect(f.studio.state().ideas.find(idea => idea.id === f.id)?.increment?.files).toHaveLength(1);
});

it('never falls back to all context for an explicit empty selected mode', async () => {
  const f = await fixture(); await f.studio.startWorkflow(f.id);
  const step = f.current().definition.steps[0];
  if (step?.kind !== 'council') throw new Error('Expected Council step');
  expect(() => councilWorkflowInputs(f.current(), { ...step, contextMode: 'selected', inputs: [] })).toThrow('Choose at least one');
  expect(() => workflowDefinitionCheck({ ...f.current().definition, steps: [{ ...step, contextMode: 'selected', inputs: [] }] })).toThrow('Choose at least one');
});

it('reconciles a confirmed child after reload without preparing or creating another one', async () => {
  const f = await fixture({ contextMode: 'none' }); const original = await f.studio.startWorkflow(f.id);
  await f.studio.stop();
  const create = vi.fn(async () => { throw new Error('Must not create after reload'); });
  const restarted = new StudioService(f.storage, { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: true, projectPath: null, allowImplementation: false }),
    agentTasks: { create, result: async () => ({ state: 'completed', projectId: 'CFP-001', sourcePath: f.calls[0]!.sourcePath, sourceId: 'confirmed-source', markdown: 'Retained published answer.' }) },
  });
  await restarted.start(); cleanups.push(() => restarted.stop());
  const resumed = await restarted.runWorkflowStep(f.id);
  expect(resumed.cursor).toBe(1); expect(resumed.councilBindings).toEqual(original.councilBindings);
  expect(resumed.definition.steps[0]).toMatchObject({ contextMode: 'none' });
  expect(resumed.attempts[0]?.nudgeRunId).toBe('confirmed-child'); expect(create).not.toHaveBeenCalled();
});

it('holds interrupted cancellation after reload and ignores a late confirmation from the unloaded instance', async () => {
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  const f = await fixture({ cancel: async () => pending });
  await f.studio.startWorkflow(f.id); const stopping = f.studio.stopWorkflow(f.id);
  await vi.waitFor(() => expect(f.current().attempts[0]?.councilCancellation).toBe('requested'));
  await f.studio.stop();
  const cancel = vi.fn(async () => {});
  const restarted = new StudioService(f.storage, { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: true, projectPath: null, allowImplementation: false }),
    agentTasks: { create: async () => { throw new Error('No new admission'); }, prepareCouncil: async (projectId, councilId) => testCouncilBinding(projectId, councilId), result: async () => ({ state: 'pending' }), cancel },
  });
  await restarted.start(); cleanups.push(() => restarted.stop());
  try {
    const loaded = restarted.state().ideas.find(idea => idea.id === f.id)!.workflowRun!;
    expect(loaded).toMatchObject({ state: 'stopped', attempts: [{ nudgeRunId: 'confirmed-child', councilCancellation: 'unknown' }] });
    await expect(restarted.startWorkflow(f.id)).rejects.toThrow('Restart workflow');
    await expect(restarted.restartWorkflowFromOperator(f.id)).rejects.toThrow('acknowledge');
    expect(cancel).not.toHaveBeenCalled();
    release(); await stopping;
    expect((await f.storage.load()).notes.find(idea => idea.id === f.id)?.workflowRun?.attempts[0]?.councilCancellation).toBe('unknown');
  } finally { release(); await stopping; }
});
