import { afterEach, describe, expect, it } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import type { StageInput, StageRunner, StudioHost } from '../../../features/coforge/application/ports';
import { createSeed } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); });

async function setup(runner: StageRunner = async () => ({ screening: {
  verdict: 'clear', reason: 'Fixture', signals: [], checkedAt: new Date().toISOString(), provider: 'demo',
} }), probeRuntime: StudioHost['probeRuntime'] = () => Promise.resolve({ cliAvailable: true, projectPath: null, allowImplementation: false })) {
  const storage = new MemoryStorage(createSeed());
  const studio = new StudioService(storage, {
    runners: { demo: runner, claude: runner }, timers: nodeTimers(),
    probeRuntime,
  });
  services.push(studio);
  await studio.start();
  return { studio, storage };
}

describe('multiple projects in one studio', () => {
  it('migrates the current project, routes requests to their explicit parent and keeps chat shared', async () => {
    const { studio, storage } = await setup();
    const initial = studio.state().activeProjectId;
    const project = await studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: 'C:/Games/moon-orchard',
      repositoryUrl: 'https://github.com/example/moon', websiteUrl: 'https://moon.example' });
    expect(project.id).toBe('CFP-002');
    expect(project.id).not.toBe(initial);
    expect(studio.state().projects).toHaveLength(2);
    expect(studio.state().activeProjectId).toBe(project.id);
    await studio.selectProject(initial!);
    const request = await studio.sendChat('NewViewer', `!request ${project.id} Add a lantern beside the tree`);
    expect(studio.state().ideas.find(idea => idea.id === request.ideaId)?.projectId).toBe(project.id);
    expect(studio.state().ideas.find(idea => idea.id === 'CF-101')?.projectId).toBe(initial);
    expect(studio.state().activeProjectId).toBe(initial);
    await studio.selectProject(initial!);
    expect(studio.state().settings.projectName).toBe('Mosslight');
    expect(studio.state().chat.some(message => message.ideaId === request.ideaId)).toBe(true);
    const reloaded = await storage.load();
    expect(reloaded.projects?.find(item => item.id === project.id)?.projectPath).toBe('C:/Games/moon-orchard');
    expect(reloaded.projects?.find(item => item.id === project.id)).toMatchObject({ repositoryUrl: 'https://github.com/example/moon', websiteUrl: 'https://moon.example' });
  });

  it('requires a known project ID in viewer requests without allocating an idea ID on rejection', async () => {
    const { studio } = await setup();
    const before = studio.state().nextIdeaNumber;
    expect(await studio.sendChat('Viewer', '!request Add a lantern beside the tree')).toMatchObject({ ok: false });
    expect(await studio.sendChat('Viewer', '!request CFP-999 Add a lantern beside the tree')).toMatchObject({ ok: false });
    expect(studio.state().nextIdeaNumber).toBe(before);
    expect(studio.state().ideas).toHaveLength(15);
  });

  it('keeps a background run bound to its original project when selection changes', async () => {
    let finish: (() => void) | undefined;
    let input: StageInput | undefined;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const { studio } = await setup(async next => {
      input = next;
      await pending;
      return { screening: { verdict: 'clear', reason: 'Fixture', signals: [], checkedAt: new Date().toISOString(), provider: 'demo' } };
    });
    await studio.updateIntegration({ projectPath: 'C:/Games/mosslight' });
    const initial = studio.state().activeProjectId!;
    const other = await studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: 'D:/Games/moon' });
    await studio.selectProject(initial);
    await studio.act('CF-107', 'screen');
    await expect.poll(() => input?.idea.id).toBe('CF-107');
    await studio.selectProject(other.id);
    expect(input?.integration.projectPath).toBe('C:/Games/mosslight');
    expect(input?.settings.projectName).toBe('Mosslight');
    finish?.();
    await studio.engine.waitUntilIdle();
    expect(studio.state().activeProjectId).toBe(other.id);
    expect(studio.state().ideas.find(idea => idea.id === 'CF-107')?.status).toBe('screened');
    expect(studio.state().settings.projectName).toBe('Moon orchard');
  });

  it('does not overwrite the selected workspace when an earlier project’s CLI probe completes', async () => {
    let finish: ((value: Awaited<ReturnType<StudioHost['probeRuntime']>>) => void) | undefined;
    const probe = new Promise<Awaited<ReturnType<StudioHost['probeRuntime']>>>(resolve => { finish = resolve; });
    const { studio } = await setup(undefined, () => probe);
    await studio.updateIntegration({ projectPath: '/games/mosslight' });
    const initial = studio.state().activeProjectId!;
    const other = await studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon' });
    await studio.selectProject(initial);
    const checking = studio.refreshRuntime();
    await studio.selectProject(other.id);
    finish?.({ cliAvailable: true, projectPath: '/games/mosslight', allowImplementation: true });
    await checking;
    expect(studio.state().runtime).toMatchObject({ projectPath: '/games/moon', allowImplementation: false, cliAvailable: true });
  });

  it('keeps the selected project unchanged when a project write fails', async () => {
    const { studio, storage } = await setup();
    const before = studio.state();
    storage.failNextSave = true;
    await expect(studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon' })).rejects.toThrow('Disk full');
    expect(studio.state()).toEqual(before);
  });

  it('rejects unsafe links before allocating a project ID or changing selection', async () => {
    const { studio } = await setup();
    const before = studio.state();
    await expect(studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon', websiteUrl: 'javascript:alert(1)' })).rejects.toThrow('URL');
    expect(studio.state()).toEqual(before);
  });

  it('dispatches resumed projects in the background and pauses every project after restarting', async () => {
    const { studio, storage } = await setup();
    await studio.updateSettings({ paused: false });
    const other = await studio.createProject({ projectName: 'Moon orchard', projectBrief: 'An orchard on a distant moon.', projectPath: '/games/moon' });
    expect(studio.state().settings.paused).toBe(true);
    const job = await studio.engine.tick(false);
    expect(job?.ideaId).toBeDefined();
    expect(studio.state().ideas.find(idea => idea.id === job?.ideaId)?.projectId).not.toBe(other.id);
    await studio.engine.waitUntilIdle();
    await studio.stop();
    const restarted = new StudioService(storage, {
      runners: { demo: async () => ({}), claude: async () => ({}) }, timers: nodeTimers(),
      probeRuntime: () => Promise.resolve({ cliAvailable: true, projectPath: null, allowImplementation: false }),
    });
    services.push(restarted);
    await restarted.start();
    expect(restarted.state().projects?.every(project => project.settings.paused)).toBe(true);
  });
});
