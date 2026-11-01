import { afterEach, expect, it } from 'vitest';
import { createIdea, ingestChat } from '../../../features/coforge/application/chat';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { ideaBody, ideaProperties, parseIdeaNote } from '../../../features/coforge/domain/idea-note';
import { ai, fixture, result } from './configured-workflow-fixture';
import { MemoryStorage, nodeTimers, registerTestViewers, seededStore } from './memory-storage';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { updateRequestValues } from '../../../features/coforge/application/request-values';
import { ideaFingerprint } from '../../../features/coforge/domain/integrity';
import { objectDefinition } from './request-object-fixture';
import { samplePlan } from '../../../features/coforge/domain/seed';
import { ideaWorkflowAction } from '../../../presentation/composables/coforge/idea-workflow-action';

const engines: WorkflowEngine[] = [];
afterEach(async () => { await Promise.all(engines.splice(0).map(engine => engine.stop())); });
const ownerInput = { title: 'Owner feature request', description: 'Add a new game feature.', username: 'Owner' };

it('admits a studio owner request directly to scoring with honest, durable provenance', async () => {
  const { store, storage } = await seededStore();
  const idea = await store.transaction(state => createIdea(state, ownerInput));
  expect(idea).toMatchObject({ status: 'screened', screening: { verdict: 'clear', provider: 'owner', signals: [] } });
  expect(parseIdeaNote(ideaProperties(idea, 'Owner'), ideaBody(idea)).screening).toEqual(idea.screening);
  const restored = new StudioStore(storage); await restored.init();
  expect(restored.snapshot().ideas.find(item => item.id === idea.id)?.screening).toEqual(idea.screening);
  const calls: string[] = [];
  const runner = async () => { calls.push('score'); return { rice: { reach: 10, impact: 1, confidence: 1, effort: 1, score: 10, rationale: 'Estimated' } }; };
  const engine = new WorkflowEngine(restored, { runners: { demo: runner, claude: runner }, timers: nodeTimers() }); engines.push(engine);
  await expect(engine.submit(idea.id, 'implement')).rejects.toThrow();
  await expect(engine.action(idea.id, 'approve')).rejects.toThrow();
  await engine.submit(idea.id, 'score'); await engine.waitUntilIdle();
  expect(calls).toEqual(['score']);
  expect(restored.snapshot().ideas.find(item => item.id === idea.id)?.status).toBe('ranked');
});

it('skips configured screening without a provider call and supplies its explicit input contract', async () => {
  const score = { ...ai('score', 'rice'), inputs: ['screening' as const] };
  const f = await fixture([ai('screen', 'screening'), score]); engines.push(f.engine);
  const idea = await f.store.transaction(state => createIdea(state, ownerInput));
  await f.engine.startWorkflow(idea.id); await f.engine.waitUntilIdle();
  expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['score']);
  expect(f.calls[0]?.workflow?.inputArtifacts[0]?.screening?.provider).toBe('owner');
  const current = f.store.snapshot().ideas.find(item => item.id === idea.id)!;
  expect(current.workflowRun?.attempts[0]).toMatchObject({ stepId: 'screen', status: 'skipped' });
  expect(current.workflowRun?.attempts[0]?.jobId).toBeUndefined();
  expect(current.workflowRun?.state).toBe('finished');
  expect(parseIdeaNote(ideaProperties(current, 'Owner'), ideaBody(current)).workflowRun).toEqual(current.workflowRun);
  expect(current.status).toBe('ranked');
  const restored = new StudioStore(f.storage); await restored.init();
  expect(restored.snapshot().ideas.find(item => item.id === idea.id)?.workflowRun).toEqual(current.workflowRun);
});

it('keeps viewer intake screened even when the display name is Owner, and invalidates an owner exemption after viewer context', async () => {
  const { store } = await seededStore();
  await registerTestViewers(store, [{ username: 'Owner' }]);
  const viewer = await ingestChat(store, { username: 'Owner', text: '!request CFP-001 A viewer request for more lanterns' });
  expect(store.snapshot().ideas.find(item => item.id === viewer.ideaId)).toMatchObject({ status: 'inbox' });
  expect(store.snapshot().ideas.find(item => item.id === viewer.ideaId)?.screening).toBeUndefined();
  const owner = await store.transaction(state => createIdea(state, ownerInput));
  await ingestChat(store, { username: 'Owner', text: `!context ${owner.id} More details from a viewer` });
  const current = store.snapshot().ideas.find(item => item.id === owner.id)!;
  expect(current.status).toBe('inbox'); expect(current.screening).toBeUndefined();
});

it('does not exempt unknown historical intake', async () => {
  const f = await fixture([ai('screen', 'screening')], async input => result(input)); engines.push(f.engine);
  await f.store.transaction(state => { if (state.requestOrigins) delete state.requestOrigins[f.idea.id]; });
  await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
  expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['screen']);
});

it.each(['12345', 'twitch:12345'])('exempts broadcaster account %s using channel and account IDs, never a matching name', async userId => {
  const { store } = await seededStore();
  await store.transaction(state => { state.integration.twitchBroadcasterId = '12345'; });
  await registerTestViewers(store, [{ username: 'ChannelOwner', userId, source: 'twitch' }, { username: 'ChannelOwner', userId: '67890', source: 'twitch' }]);
  const owner = await ingestChat(store, { username: 'ChannelOwner', userId, channelId: '12345', source: 'twitch', text: '!request CFP-001 Add a stream owner feature' });
  const viewer = await ingestChat(store, { username: 'ChannelOwner', userId: '67890', channelId: '12345', source: 'twitch', text: '!request CFP-001 Add a viewer feature for the game' });
  expect(store.snapshot().ideas.find(item => item.id === owner.ideaId)?.screening?.provider).toBe('owner');
  expect(store.snapshot().ideas.find(item => item.id === viewer.ideaId)?.screening).toBeUndefined();
});

it('revokes an owner exemption when the canonical request is edited outside CoForge', async () => {
  const { store } = await seededStore();
  const idea = await store.transaction(state => createIdea(state, ownerInput));
  const changed = store.internalSnapshot(); changed.ideas.find(item => item.id === idea.id)!.description = 'Externally changed request text';
  const restored = new StudioStore(new MemoryStorage(changed)); await restored.init();
  const current = restored.snapshot().ideas.find(item => item.id === idea.id)!;
  expect(current.status).toBe('inbox'); expect(current.screening).toBeUndefined();
});

it('automatically proceeds past a disabled, unavailable screening provider to the enabled scoring step', async () => {
  const f = await fixture([{ ...ai('screen', 'screening'), provider: 'claude', automatic: false,
    coworkerId: 'missing-screen-agent', outputTemplateId: 'missing-screen-template' }, ai('score', 'rice')]); engines.push(f.engine);
  const owner = await f.store.transaction(state => {
    state.runtime.cliAvailable = false;
    for (const idea of state.ideas) state.manualHolds.push(idea.id);
    return createIdea(state, ownerInput);
  });
  expect(ideaWorkflowAction(owner, f.store.snapshot().projects?.[0], f.store.snapshot().runtime)).toMatchObject({ label: 'Start · score', blocked: '' });
  await f.engine.tick(false); await f.engine.waitUntilIdle();
  expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['score']);
  expect(f.store.snapshot().ideas.find(item => item.id === owner.id)?.workflowRun?.state).toBe('finished');
});

it('keeps owner-edited request fields exempt while invalidating earlier scoring and planning', async () => {
  const { store } = await seededStore();
  const idea = await store.transaction(state => {
    state.settings.requestObject = objectDefinition();
    const created = createIdea(state, ownerInput);
    created.rice = { reach: 10, impact: 1, confidence: 1, effort: 1, score: 10, rationale: 'Old estimate' };
    created.plan = samplePlan(created.title, created.createdAt); created.status = 'planned';
    return created;
  });
  await updateRequestValues(store, idea.id, { customer: 'Updated by the owner' }, ideaFingerprint(idea));
  const current = store.snapshot().ideas.find(item => item.id === idea.id)!;
  expect(current.status).toBe('screened'); expect(current.screening?.provider).toBe('owner');
  expect(current.rice).toBeUndefined(); expect(current.plan).toBeUndefined(); expect(current.lastError).toBeUndefined();
});

it('finishes a screening-only owner workflow without invoking a provider or inventing an increment', async () => {
  const f = await fixture([ai('screen', 'screening')]); engines.push(f.engine);
  const owner = await f.store.transaction(state => createIdea(state, ownerInput));
  expect(ideaWorkflowAction(owner, f.store.snapshot().projects?.[0], f.store.snapshot().runtime)?.label).toBe('Complete workflow');
  await f.engine.startWorkflow(owner.id); await f.engine.waitUntilIdle();
  const current = f.store.snapshot().ideas.find(idea => idea.id === owner.id)!;
  expect(f.calls).toEqual([]); expect(current.workflowRun?.state).toBe('finished');
  expect(current.increment).toBeUndefined(); expect(current.status).toBe('screened');
});

it.each(['inbox', 'flagged'] as const)('rejects an externally forged owner exemption on a %s note', async status => {
  const { store } = await seededStore();
  const changed = store.internalSnapshot();
  const idea = changed.ideas.find(item => item.status === status)!;
  idea.screening = { provider: 'owner', verdict: 'clear', reason: 'Untrusted external metadata', signals: [], checkedAt: idea.updatedAt };
  const restored = new StudioStore(new MemoryStorage(changed)); await restored.init();
  expect(restored.snapshot().ideas.find(item => item.id === idea.id)?.screening).toBeUndefined();
});
