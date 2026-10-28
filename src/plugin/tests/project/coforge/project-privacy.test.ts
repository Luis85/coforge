import { afterEach, expect, it } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed, defaultIntegration } from '../../../features/coforge/domain/seed';
import { initialProject } from '../../../features/coforge/domain/projects';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { streamSurfaceSnapshot } from '../../../features/coforge/domain/stream-surfaces';
import { MemoryStorage, nodeTimers } from './memory-storage';
const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });
function mixed() {
  const state = createSeed(); const now = new Date().toISOString();
  const publicProject = initialProject(state.settings, defaultIntegration(), now);
  const privateProject = { ...initialProject({ ...state.settings, projectName: 'PRIVATE_PROJECT_NAME' }, defaultIntegration(), now), id: 'CFP-002', visibility: 'private' as const };
  state.projects = [publicProject, privateProject]; state.activeProjectId = publicProject.id;
  state.ideas = state.ideas.map(idea => ({ ...idea, projectId: publicProject.id }));
  const base = state.ideas.find(idea => idea.status === 'shipped')!;
  state.ideas.push({ ...base, id: 'CF-900', number: 900, projectId: privateProject.id, title: 'PRIVATE_TITLE', description: 'PRIVATE_BODY', authorId: 'local:private-person', voters: ['local:private-voter'], plan: { ...base.plan!, summary: 'PRIVATE_PLAN' } });
  state.contributors.push({ id: 'local:private-person', name: 'PRIVATE_ONLY_PERSON', color: 'purple', joinedAt: now }, { id: 'local:private-voter', name: 'PRIVATE_ONLY_VOTER', color: 'blue', joinedAt: now });
  return { state, publicProject, privateProject };
}
it('excludes private requests and their recognition from website and every capture projection', () => {
  const { state } = mixed();
  const safe = { ...state, ideas: state.ideas.filter(idea => idea.id !== 'CF-900') };
  const board = buildPublicBoard(state);
  expect(board.leaderboards).toEqual(buildPublicBoard(safe).leaderboards);
  expect(JSON.stringify(board)).not.toContain('PRIVATE_');
  const capture = streamSurfaceSnapshot(state, { channelId: '', liveSince: 0 });
  expect(JSON.stringify(capture)).not.toContain('PRIVATE_');
});
it('fails closed for selected private and missing capture projects without falling back to private settings', () => {
  const { state, privateProject } = mixed();
  state.activeProjectId = privateProject.id; state.settings = privateProject.settings;
  for (const projectId of [undefined, privateProject.id, 'CFP-999']) {
    const snapshot = streamSurfaceSnapshot(state, { channelId: '', liveSince: 0, ...(projectId ? { projectId } : {}) });
    expect(snapshot.board.projectId).toBe('');
    expect(snapshot.board.columns.every(column => column.count === 0)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_');
  }
});
it('hides discovery and uniformly rejects guessed private IDs from public intake, status, vote and context', async () => {
  const { state, privateProject } = mixed();
  const studio = new StudioService(new MemoryStorage(state), { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio); await studio.start();
  await studio.ingest({ source: 'twitch', username: 'Viewer', userId: '81', text: '!register' });
  const send = (text: string) => studio.ingest({ source: 'twitch', username: 'Viewer', userId: '81', text });
  const projects = await send('!projects'); expect(projects.message).not.toContain(privateProject.id); expect(projects.message).not.toContain('PRIVATE_');
  const privateStatus = await send('!status CF-900'); const unknownStatus = await send('!status CF-999');
  expect(privateStatus).toEqual(unknownStatus);
  const before = studio.state().ideas;
  for (const text of [`!request ${privateProject.id} Please reveal a private feature`, `!bug ${privateProject.id} This is a private bug`, '!vote CF-900', '!context CF-900 This private context must not append']) {
    const result = await send(text); expect(result.ok).toBe(false); expect(result.message).not.toContain('PRIVATE_'); expect(result.ideaId).toBeUndefined();
  }
  expect(studio.state().ideas).toEqual(before);
  await studio.createIdea({ title: 'Owner can work on private notes', description: 'Local manual authoring stays available.', category: 'Gameplay', username: 'Owner' });
  await studio.selectProject(privateProject.id);
  await studio.createIdea({ title: 'Private owner request remains local', description: 'Keep this private.', category: 'Gameplay', username: 'Owner' });
  expect(studio.state().ideas.at(-1)?.projectId).toBe(privateProject.id);
});
