import { describe, expect, it } from 'vitest';
import { ObsOverlayWorkflow } from '../../../features/coforge/application/obs-overlay-workflow';
import type { ObsProductionSnapshot } from '../../../features/coforge/domain/obs-production';
import type { ObsOverlayDefinition } from '../../../features/coforge/domain/obs-overlay';
import { obsProductionActionCheck } from '../../../features/coforge/domain/obs-production-check';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { IntegrationFailure } from '../../../features/coforge/domain/integration-failure';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { seededStore } from './memory-storage';

async function kit() {
  const { store, storage } = await seededStore();
  const value = store.snapshot();
  const board = buildPublicBoard(value);
  const idea = board.columns.flatMap(column => column.ideas)[0]!;
  const state: ObsProductionSnapshot = {
    context: { epoch: 1, collection: 0, revision: 1 }, broadcast: { epoch: 1, revision: 1, scenes: [{ id: 'live', name: 'Live' }], programSceneId: 'live', active: true, reconnecting: false, transitioning: false, timecode: '', observedAt: new Date().toISOString() },
    observedAt: new Date().toISOString(), available: ['input-settings'], inputKinds: ['text_gdiplus_v2'], filterKinds: [],
    inputs: [{ id: 'overlay-source', name: 'CoForge public text', kind: 'text_gdiplus_v2', settings: { text: 'Original', read_from_file: true }, audio: { muted: null, volumeDb: null, monitor: null, syncOffset: null, tracks: null, peakDb: null, meterObservedAt: null } }],
    studioMode: false, transitions: [], transition: null, recording: null, replayBuffer: null, virtualCamera: null, video: null, recordDirectory: null, lastRecording: null, lastReplay: null,
  };
  const calls: unknown[] = [];
  const production = { inspect: async () => structuredClone(state), execute: async (input: unknown) => {
    const action = obsProductionActionCheck(input);
    expect(store.snapshot().obsShow?.overlays?.some(item => ['publishing', 'revocation-required'].includes(item.publication?.status ?? ''))).toBe(true);
    calls.push(action);
    if (action.kind === 'input-settings') state.inputs[0]!.settings = { ...state.inputs[0]!.settings, ...action.settings };
    return structuredClone(state);
  } };
  const workflow = new ObsOverlayWorkflow(store, production);
  const definition: ObsOverlayDefinition = { id: 'overlay-request', name: 'Current request', kind: 'request', projectId: board.projectId, inputId: 'overlay-source', subjectId: idea.id, publicConfirmed: true };
  return { store, storage, state, calls, workflow, definition, idea, production };
}
describe('CoForge public OBS overlay composer', () => {
  it('keeps readable line breaks but rejects nonprinting control characters before public output', async () => {
    const app = await kit();
    const definition = { ...app.definition, kind: 'council-excerpt', excerpt: 'Reviewed first line\nReviewed second line\twith a tab' };
    const preview = await app.workflow.preview(definition);
    expect(preview.text).toContain(definition.excerpt);
    await expect(app.workflow.preview({ ...definition, excerpt: 'Hidden\u0001control' })).rejects.toThrow('control');
    expect(app.calls).toEqual([]);
  });
  it('previews exact public text without effects, then explicitly publishes in literal text mode', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(app.definition);
    expect(app.calls).toEqual([]);
    expect(preview.text).toContain(app.idea.title);
    expect(preview).toMatchObject({ switchesFromFile: true, onAir: true, shared: true });
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    expect(app.state.inputs[0]?.settings).toMatchObject({ text: preview.text, read_from_file: false });
    expect(app.workflow.snapshot()[0]?.publication).toMatchObject({ status: 'published', text: preview.text });
  });
  it('rejects private/unscreened/stale previews and failed intent persistence before changing OBS', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(app.definition);
    await app.store.transaction(state => { state.ideas.find(idea => idea.id === app.idea.id)!.status = 'flagged'; });
    await expect(app.workflow.publish({ previewId: preview.id, confirmed: true })).rejects.toThrow();
    expect(app.calls).toEqual([]);
    await expect(app.workflow.preview({ ...app.definition, subjectId: 'missing' })).rejects.toThrow();
  });
  it('clears only owned published text when its public request is revoked', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    await app.store.transaction(state => { state.ideas.find(idea => idea.id === app.idea.id)!.status = 'flagged'; });
    await expect(app.workflow.refreshOverlay(app.definition.id)).rejects.toThrow();
    expect(app.state.inputs[0]?.settings.text).toBe('');
    expect(app.workflow.snapshot()[0]?.publication?.status).toBe('cleared');
  });
  it('does not overwrite externally edited text during revocation and requires explicit recovery', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    app.state.inputs[0]!.settings.text = 'External operator text';
    await app.store.transaction(state => { state.ideas.find(idea => idea.id === app.idea.id)!.status = 'flagged'; });
    await expect(app.workflow.refreshOverlay(app.definition.id)).rejects.toThrow();
    expect(app.state.inputs[0]?.settings.text).toBe('External operator text');
    expect(app.workflow.snapshot()[0]?.publication?.status).toBe('revocation-required');
  });
  it('rejects retired music overlays and renders fixed reviewed Council text without reading private task content', async () => {
    const app = await kit();
    await expect(app.workflow.preview({ ...app.definition, kind: 'now-playing', subjectId: undefined })).rejects.toThrow('OBS media sources');
    expect((await app.workflow.preview({ ...app.definition, kind: 'council-excerpt', excerpt: 'Reviewed public advice' })).text).toContain('Reviewed public advice');
    await expect(app.workflow.preview({ ...app.definition, kind: 'council-excerpt', excerpt: 'Private draft', publicConfirmed: false })).rejects.toThrow();
    await expect(app.workflow.preview({ ...app.definition, kind: 'now-playing', subjectId: undefined })).rejects.toThrow();
  });
  it('keeps saved targets unique and rejects a write when definition intent cannot be persisted', async () => {
    const app = await kit();
    let preview = await app.workflow.preview(app.definition);
    app.storage.failNextSave = true;
    await expect(app.workflow.publish({ previewId: preview.id, confirmed: true })).rejects.toThrow();
    expect(app.calls).toEqual([]);
    preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    await expect(app.workflow.preview({ ...app.definition, id: 'second-owner' })).rejects.toThrow();
  });
  it('automatically attempts one owned clear on privacy revocation and holds disconnected clears without replay', async () => {
    const app = await kit();
    await app.workflow.start();
    try {
      const preview = await app.workflow.preview(app.definition);
      await app.workflow.publish({ previewId: preview.id, confirmed: true });
      const inspect = app.production.inspect;
      app.production.inspect = async () => { throw new IntegrationFailure('service', 'Disconnected'); };
      await app.store.transaction(state => { state.projects!.find(project => project.id === app.definition.projectId)!.visibility = 'private'; });
      await expect.poll(() => app.workflow.snapshot()[0]?.publication?.status).toBe('revocation-required');
      app.production.inspect = inspect;
      await app.store.transaction(state => { state.settings.projectBrief = 'An unrelated private edit'; });
      expect(app.calls).toHaveLength(1);
      await app.workflow.clear(app.definition.id);
      expect(app.state.inputs[0]?.settings.text).toBe('');
      expect(app.workflow.snapshot()[0]?.publication?.status).toBe('cleared');
    } finally { app.workflow.dispose(); }
  });
  it('retains unknown publication ownership across reload without replaying the OBS write', async () => {
    const app = await kit();
    const execute = app.production.execute;
    app.production.execute = async input => { await execute(input); throw new IntegrationFailure('uncertain', 'Lost confirmation'); };
    const preview = await app.workflow.preview(app.definition);
    await expect(app.workflow.publish({ previewId: preview.id, confirmed: true })).rejects.toMatchObject({ kind: 'uncertain' });
    expect(app.workflow.snapshot()[0]?.publication?.status).toBe('uncertain');
    app.workflow.dispose();
    const reopened = new ObsOverlayWorkflow(app.store, app.production);
    await reopened.start();
    expect(app.calls).toHaveLength(1);
    expect(reopened.snapshot()[0]?.publication?.status).toBe('uncertain');
    reopened.dispose();
  });
  it('lists only public candidates and supports explicit dynamic refresh of a saved public mapping', async () => {
    const app = await kit();
    const initial = await app.workflow.candidates('');
    expect(initial.projects.map(project => project.id)).toContain(app.definition.projectId);
    expect(initial.requests).toEqual([]);
    const preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    await app.store.transaction(state => { state.ideas.find(idea => idea.id === app.idea.id)!.voters.push('new-public-voter'); });
    await app.workflow.refreshOverlay(app.definition.id);
    expect(app.state.inputs[0]?.settings.text).not.toBe(preview.text);
    await app.store.transaction(state => { state.projects!.find(project => project.id === app.definition.projectId)!.visibility = 'private'; });
    expect((await app.workflow.candidates('')).projects.map(project => project.id)).not.toContain(app.definition.projectId);
    await expect(app.workflow.candidates(app.definition.projectId)).rejects.toThrow();
  });
  it('celebrates accepted public work and recognition without exposing increment diffs or repository files', async () => {
    const app = await kit();
    const choices = await app.workflow.candidates(app.definition.projectId);
    const accepted = choices.increments[0]!;
    const recognition = choices.recognition[0]!;
    const increment = await app.workflow.preview({ ...app.definition, kind: 'increment', subjectId: accepted.id });
    expect(increment.text).toContain('Accepted: ' + accepted.id);
    const contributor = await app.workflow.preview({ ...app.definition, kind: 'recognition', subjectId: recognition.id });
    expect(contributor.text).toContain(recognition.name);
    expect(increment.text + contributor.text).not.toMatch(/worktree|diff --git|src\//);
    expect(app.calls).toEqual([]);
  });
  it('keeps legacy ownership readable and clears the retired music overlay on startup', async () => {
    const app = await kit();
    app.state.inputs[0]!.settings = { text: 'Legacy track credit', read_from_file: false };
    await app.store.transaction(state => { state.obsShow = { plans: [], history: [], automationEnabled: false, lastEventSequence: 0, markers: [], overlays: [{ ...app.definition, kind: 'now-playing', publication: { status: 'published', text: 'Legacy track credit', inputKind: 'text_gdiplus_v2' } }] }; });
    expect(parsePersistedStudio((await app.storage.load()).data).obsShow?.overlays?.[0]?.kind).toBe('now-playing');
    await app.workflow.start();
    expect(app.state.inputs[0]?.settings.text).toBe('');
    expect(app.workflow.snapshot()[0]?.publication?.status).toBe('cleared');
    await app.workflow.remove(app.definition.id);
    expect(app.workflow.snapshot()).toEqual([]);
    app.workflow.dispose();
  });
  it('does not retain a preview or publish after disposal during its asynchronous source read', async () => {
    const app = await kit();
    let release: ((value: ObsProductionSnapshot) => void) | undefined;
    app.production.inspect = () => new Promise(resolve => { release = resolve; });
    const preview = app.workflow.preview(app.definition);
    app.workflow.dispose();
    release?.(app.state);
    await expect(preview).rejects.toThrow();
    expect(app.calls).toEqual([]);
  });
  it('rejects a stale dynamic refresh when the approved mapping changes during its source read', async () => {
    const app = await kit();
    const definition = { ...app.definition, kind: 'council-excerpt', excerpt: 'Original approved advice' } as const;
    const preview = await app.workflow.preview(definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    let release: ((value: ObsProductionSnapshot) => void) | undefined;
    app.production.inspect = () => new Promise(resolve => { release = resolve; });
    const refresh = app.workflow.refreshOverlay(definition.id);
    await app.store.transaction(state => { state.obsShow!.overlays![0]!.excerpt = 'New approved advice'; });
    release?.(app.state);
    await expect(refresh).rejects.toThrow(/mapping changed/);
    expect(app.calls).toHaveLength(1);
    expect(app.workflow.snapshot()[0]?.excerpt).toBe('New approved advice');
  });
  it('keeps a concurrently republished mapping when removal resumes after its clear', async () => {
    const app = await kit();
    let preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    const clear = app.workflow.clear.bind(app.workflow);
    let release: (() => void) | undefined;
    const wait = new Promise<void>(resolve => { release = resolve; });
    app.workflow.clear = async id => { await clear(id); await wait; };
    const removing = app.workflow.remove(app.definition.id);
    await expect.poll(() => app.workflow.snapshot()[0]?.publication?.status).toBe('cleared');
    preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    release?.();
    await expect(removing).rejects.toThrow(/changed after clearing/);
    expect(app.workflow.snapshot()[0]?.publication?.status).toBe('published');
    expect(app.state.inputs[0]?.settings.text).toBe(preview.text);
  });
  it('publishes to a current Windows GDI v3 source in literal text mode', async () => {
    const app = await kit();
    app.state.inputs[0]!.kind = 'text_gdiplus_v3';
    expect((await app.workflow.candidates('')).inputs).toEqual([{ id: 'overlay-source', name: 'CoForge public text' }]);
    const preview = await app.workflow.preview(app.definition);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    expect(app.state.inputs[0]?.settings).toMatchObject({ text: preview.text, read_from_file: false });
  });
  it('round-trips the exact 4000-character public text limit and rejects longer content before publication', async () => {
    const app = await kit();
    const choices = await app.workflow.candidates(app.definition.projectId);
    const contributor = choices.recognition[0]!;
    const definition = { ...app.definition, kind: 'recognition', subjectId: contributor.id } as const;
    await app.store.transaction(state => { state.contributors.find(person => person.id === contributor.id)!.name = 'A'; });
    const first = await app.workflow.preview(definition);
    const name = 'A'.repeat(4001 - first.text.length);
    await app.store.transaction(state => { state.contributors.find(person => person.id === contributor.id)!.name = name; });
    const preview = await app.workflow.preview(definition);
    expect(preview.text).toHaveLength(4000);
    await app.workflow.publish({ previewId: preview.id, confirmed: true });
    expect(parsePersistedStudio((await app.storage.load()).data).obsShow?.overlays?.[0]?.publication?.text).toBe(preview.text);
    await app.store.transaction(state => { state.contributors.find(person => person.id === contributor.id)!.name = name + 'A'; });
    await expect(app.workflow.preview(definition)).rejects.toThrow(/oversized/);
    expect(app.calls).toHaveLength(1);
  });
});
