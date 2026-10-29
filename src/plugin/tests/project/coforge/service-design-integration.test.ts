// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { createCoforgeRuntime } from '../../../infrastructure/coforge/runtime';

function fixture(files: Record<string, string> = {}) {
  const app = new App();
  const kit = createTestApp({ app, files, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, {
    id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '',
  });
  return { kit, plugin, runtime: createCoforgeRuntime(plugin, () => undefined) };
}

it.each(['CoForge/Service Design', 'Private/Retained', 'Private/Current/Requests', 'Private'])(
  'rejects reverse ideas-folder overlap with %s, preserving settings and reload usability', async folder => {
    const { kit, runtime } = fixture();
    try {
      await runtime.start();
      await runtime.host.serviceDesign!.configure('Private/Retained');
      await runtime.host.serviceDesign!.configure('Private/Current');
      const previous = kit.read('.obsidian/plugins/coforge/coforge-state.json');
      await expect(runtime.studio.updateIntegration({ ideasFolder: folder })).rejects.toThrow('Service Design');
      expect(kit.read('.obsidian/plugins/coforge/coforge-state.json')).toBe(previous);
      expect((await runtime.host.serviceDesign!.load()).folder).toBe('Private/Current');
      await runtime.dispose();
      const reloaded = fixture({
        '.obsidian/plugins/coforge/coforge-state.json': kit.read('.obsidian/plugins/coforge/coforge-state.json'),
        '.obsidian/plugins/coforge/coforge-service-design.json': kit.read('.obsidian/plugins/coforge/coforge-service-design.json'),
      }).runtime;
      try {
        await reloaded.start();
        expect(reloaded.startupError()).toBeNull();
        expect((await reloaded.host.serviceDesign!.load()).folder).toBe('Private/Current');
      } finally { await reloaded.dispose(); }
    } finally { await runtime.dispose(); }
  },
);

it.each(['CoForge/Service Design', 'Private/Retained', 'Private/Current/Agents', 'Private'])(
  'rejects reverse Council definition-folder overlap with %s before saving preferences', async folder => {
    const { kit, runtime } = fixture();
    try {
      await runtime.start();
      await runtime.host.serviceDesign!.configure('Private/Retained');
      await runtime.host.serviceDesign!.configure('Private/Current');
      const council = runtime.host.council!;
      await council.designateExecutor();
      const preferences = council.snapshot().preferences;
      const before = kit.read('.obsidian/plugins/coforge/coforge-council-settings.json');
      const folders = { agents: folder, teams: 'CoForge/Teams', councils: 'CoForge/Councils' };
      await expect(council.definitionFolders.preview(folders)).rejects.toThrow('Service Design');
      await expect(council.definitionFolders.configure(folders, preferences.revision)).rejects.toThrow('Service Design');
      expect(kit.read('.obsidian/plugins/coforge/coforge-council-settings.json')).toBe(before);
      expect(council.snapshot().preferences).toEqual(preferences);
      expect((await runtime.host.serviceDesign!.load()).folder).toBe('Private/Current');
    } finally { await runtime.dispose(); }
  },
);

it('reserves a pending Service Design root before another managed-folder configuration can commit', async () => {
  const { kit, plugin, runtime } = fixture();
  const originalWrite = plugin.app.vault.adapter.write.bind(plugin.app.vault.adapter);
  let release = () => {};
  let writing = false;
  let configuring: Promise<unknown> = Promise.resolve();
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    await runtime.start();
    const council = runtime.host.council!;
    await council.designateExecutor();
    const preferences = kit.read('.obsidian/plugins/coforge/coforge-council-settings.json');
    vi.spyOn(plugin.app.vault.adapter, 'write').mockImplementation(async (path, contents, options) => {
      if (path === 'Private/Pending/.gitignore') { writing = true; await held; }
      return originalWrite(path, contents, options);
    });
    configuring = runtime.host.serviceDesign!.configure('Private/Pending');
    await vi.waitFor(() => expect(writing).toBe(true));
    const before = kit.read('.obsidian/plugins/coforge/coforge-state.json');
    await expect(runtime.studio.updateIntegration({ ideasFolder: 'Private/Pending/Requests' })).rejects.toThrow('Service Design');
    await expect(council.definitionFolders.configure({
      agents: 'Private/Pending/Agents', teams: 'CoForge/Teams', councils: 'CoForge/Councils',
    }, council.snapshot().preferences.revision)).rejects.toThrow('Service Design');
    expect(kit.read('.obsidian/plugins/coforge/coforge-state.json')).toBe(before);
    expect(kit.read('.obsidian/plugins/coforge/coforge-council-settings.json')).toBe(preferences);
    release();
    await configuring;
    expect((await runtime.host.serviceDesign!.load()).folder).toBe('Private/Pending');
  } finally { release(); await configuring; await runtime.dispose(); vi.restoreAllMocks(); }
});

it('still permits a Council inbox to contain ordinary request notes', async () => {
  const { runtime } = fixture();
  try {
    await runtime.start();
    const project = await runtime.studio.createProject({ projectName: 'Synthetic service project',
      projectBrief: 'Test the ordinary request inbox boundary.', projectPath: 'C:/synthetic-service-repository' });
    const council = runtime.host.council!;
    await council.designateExecutor();
    await council.saveBindings([{
      id: 'request-inbox', path: 'Requests/Inbox', projectId: project.id,
      teamId: 'team', target: { kind: 'agent', id: 'agent' }, enabled: false,
      recursive: true, submit: 'after-stable', settleMs: 0,
    }], council.snapshot().preferences.revision);
    await runtime.studio.updateIntegration({ ideasFolder: 'Requests/Inbox' });
    expect(runtime.studio.integration().ideasFolder).toBe('Requests/Inbox');
    expect(council.snapshot().preferences.bindings[0]?.path).toBe('Requests/Inbox');
  } finally { await runtime.dispose(); }
});

it.each(['ideas', 'Council'])(
  'rejects Service Design overlap while a %s folder configuration is already awaiting filesystem work', async owner => {
    const { kit, plugin, runtime } = fixture();
    const originalWrite = plugin.app.vault.adapter.write.bind(plugin.app.vault.adapter);
    let release = () => {};
    let writing = false;
    let configuring: Promise<unknown> = Promise.resolve();
    const held = new Promise<void>(resolve => { release = resolve; });
    try {
      await runtime.start();
      await runtime.host.serviceDesign!.configure('Private/Services');
      const council = runtime.host.council!;
      await council.designateExecutor();
      const before = kit.read('.obsidian/plugins/coforge/coforge-service-design.json');
      vi.spyOn(plugin.app.vault.adapter, 'write').mockImplementation(async (path, contents, options) => {
        if (path === 'Pending/Managed/.gitignore' && !writing) { writing = true; await held; }
        return originalWrite(path, contents, options);
      });
      configuring = owner === 'ideas'
        ? runtime.studio.updateIntegration({ ideasFolder: 'Pending/Managed' })
        : council.definitionFolders.configure({ agents: 'Pending/Managed', teams: 'CoForge/Teams', councils: 'CoForge/Councils' }, council.snapshot().preferences.revision);
      await vi.waitFor(() => expect(writing).toBe(true));
      await expect(runtime.host.serviceDesign!.configure('Pending/Managed')).rejects.toThrow(/managed|separate|Service Design/i);
      expect(kit.read('.obsidian/plugins/coforge/coforge-service-design.json')).toBe(before);
      release();
      await configuring;
      expect((await runtime.host.serviceDesign!.load()).folder).toBe('Private/Services');
    } finally { release(); await configuring; await runtime.dispose(); vi.restoreAllMocks(); }
  },
);

it.each(['ideas', 'Council'])(
  'releases the managed-folder reservation after failed %s filesystem work so the user can recover', async owner => {
    const { plugin, runtime } = fixture();
    try {
      await runtime.start();
      const council = runtime.host.council!;
      await council.designateExecutor();
      const originalWrite = plugin.app.vault.adapter.write.bind(plugin.app.vault.adapter);
      const write = vi.spyOn(plugin.app.vault.adapter, 'write').mockImplementation((path, contents, options) => {
        if (path === 'Pending/Failed/.gitignore') return Promise.reject(new Error('Synthetic permission failure'));
        return originalWrite(path, contents, options);
      });
      const configuring = owner === 'ideas'
        ? runtime.studio.updateIntegration({ ideasFolder: 'Pending/Failed' })
        : council.definitionFolders.configure({ agents: 'Pending/Failed', teams: 'CoForge/Teams', councils: 'CoForge/Councils' }, council.snapshot().preferences.revision);
      await expect(configuring).rejects.toThrow();
      write.mockRestore();
      await runtime.host.serviceDesign!.configure('Pending/Failed');
      expect((await runtime.host.serviceDesign!.load()).folder).toBe('Pending/Failed');
    } finally { await runtime.dispose(); vi.restoreAllMocks(); }
  },
);
