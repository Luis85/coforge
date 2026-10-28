import { afterEach, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { PublicStreamSource } from '../../../features/coforge/application/stream-surface-source';
import { projectConfigurationIdentity } from '../../../features/coforge/domain/projects';
const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });
async function setup(beforeCommit?: ConstructorParameters<typeof StudioService>[1]['beforeCommit']) {
  const storage = new MemoryStorage();
  const studio = new StudioService(storage, { beforeCommit, timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio); await studio.start();
  const project = await studio.createProject({ projectName: 'Visible game', projectBrief: 'A public game with independently controlled visibility.', projectPath: '/synthetic/game' });
  return { studio, storage, project };
}
it('keeps publication denied after failed persistence and clears it only on explicit successful public reconciliation', async () => {
  let held = false; let released = 0;
  const { studio, storage, project } = await setup(async next => {
    if (next.projects?.some(item => item.visibility === 'private')) { held = true; return () => { held = false; released++; }; }
  });
  storage.failNextSave = true;
  await expect(studio.updateProject({ visibility: 'private' }, project.id)).rejects.toThrow('Disk full');
  expect(studio.state().projects?.[0]?.visibility).toBe('public');
  expect(studio.state().runtime.publicationDeniedProjectIds).toContain(project.id);
  expect(buildPublicBoard(studio.state()).projectId).toBe('');
  expect(held).toBe(false); expect(released).toBe(1);
  await studio.updateProject({ projectBrief: 'Another normal edit must not restore public publication.' }, project.id);
  expect(studio.state().runtime.publicationDeniedProjectIds).toContain(project.id);
  await studio.updateProject({ visibility: 'public' }, project.id);
  expect(studio.state().runtime.publicationDeniedProjectIds).not.toContain(project.id);
  expect(buildPublicBoard(studio.state()).projectId).toBe(project.id);
});
it('applies visibility independently of active work while leaving immutable job configuration untouched', async () => {
  const { studio, project } = await setup();
  await studio.store.transaction(state => { state.jobs.push({ id: 'active-job', ideaId: 'CF-101', projectId: project.id, stage: 'plan', provider: 'demo', status: 'running', startedAt: new Date().toISOString(), logs: [] }); });
  const before = studio.state().jobs;
  await studio.updateProject({ visibility: 'private' }, project.id);
  expect(studio.state().projects?.[0]?.visibility).toBe('private');
  expect(studio.state().jobs).toEqual(before);
  await expect(studio.updateProject({ projectBrief: 'Actual configuration still cannot change under an active run.' }, project.id)).rejects.toThrow('queued runs');
});
it('holds publication immediately when an external private project fact cannot persist', async () => {
  const { studio, storage, project } = await setup();
  storage.failNextSave = true;
  await expect(studio.applyProjectNoteChange({ kind: 'upsert', project: { ...project, visibility: 'private' } })).rejects.toThrow('Disk full');
  expect(studio.state().runtime.publicationDeniedProjectIds).toContain(project.id);
  expect(buildPublicBoard(studio.state()).projectId).toBe('');
  await studio.ingest({ source: 'api', username: 'Remote', userId: 'remote', text: '!register' });
  const result = await studio.ingest({ source: 'api', username: 'Remote', userId: 'remote', text: `!request ${project.id} A guessed hidden project request` });
  expect(result).toMatchObject({ ok: false, message: 'This project or request is unavailable.' });
});

it('blocks already-open capture snapshots while revocation persistence is pending and holds the host lease through notification', async () => {
  let releaseGate: () => void = () => {};
  const gate = new Promise<void>(resolve => { releaseGate = resolve; });
  let held = false;
  const { studio, project } = await setup(async next => {
    if (next.projects?.some(item => item.visibility === 'private')) { held = true; await gate; return () => { held = false; }; }
  });
  const source = new PublicStreamSource(studio.store, project.id); source.start();
  expect(source.snapshot().board.project).toBe('Visible game');
  const atCommit: boolean[] = [];
  const stop = studio.onEvent(event => { if (event.type === 'project-visibility-updated') atCommit.push(held); });
  const updating = studio.updateProject({ visibility: 'private' }, project.id);
  try {
    await vi.waitFor(() => expect(held).toBe(true));
    expect(studio.state().projects?.[0]?.visibility).toBe('public');
    expect(source.snapshot().board.projectId).toBe('');
    expect(JSON.stringify(source.snapshot())).not.toContain('Visible game');
  } finally { releaseGate(); await updating; stop(); source.dispose(); }
  expect(atCommit).toEqual([true]); expect(held).toBe(false);
});

it('does not let an older public settings draft silently restore a newly private project', async () => {
  const { studio, project } = await setup();
  const expected = projectConfigurationIdentity(project);
  await studio.updateProject({ visibility: 'private' }, project.id);
  await expect(studio.updateProject({ visibility: 'public', projectBrief: 'An older public draft must not override the new private setting.' }, project.id, expected)).rejects.toThrow('changed outside');
  expect(studio.state().projects?.[0]?.visibility).toBe('private');
  expect(buildPublicBoard(studio.state()).projectId).toBe('');
});

it('rechecks a derived public API result after awaited persistence without exposing revoked discovery data', async () => {
  let releaseGate: () => void = () => {}; let entered = false;
  const gate = new Promise<void>(resolve => { releaseGate = resolve; });
  const { studio, project } = await setup(async next => { if (next.chat.some(message => message.text === '!projects')) { entered = true; await gate; } });
  const reading = studio.ingest({ source: 'api', username: 'Remote', userId: 'remote', text: '!projects' });
  try {
    await vi.waitFor(() => expect(entered).toBe(true));
    studio.store.denyPublicProjects([project.id]);
  } finally { releaseGate(); }
  const result = await reading;
  expect(result).toEqual({ ok: true, message: 'This project or request is unavailable.' });
  expect(result.message).not.toContain(project.id); expect(result.message).not.toContain(project.settings.projectName);
});

it('rechecks shop affordability after persistence when a previously public project is revoked', async () => {
  let releaseGate: () => void = () => {}; let entered = false;
  const gate = new Promise<void>(resolve => { releaseGate = resolve; });
  const { studio, project } = await setup(async next => { if (next.chat.some(message => message.text === '!shop')) { entered = true; await gate; } });
  const reading = studio.ingest({ source: 'api', username: 'Remote', userId: 'remote', text: '!shop' });
  try { await vi.waitFor(() => expect(entered).toBe(true)); studio.store.denyPublicProjects([project.id]); }
  finally { releaseGate(); }
  expect(await reading).toEqual({ ok: true, message: 'This project or request is unavailable.' });
});
