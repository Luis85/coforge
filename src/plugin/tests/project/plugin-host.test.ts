// @vitest-environment happy-dom
// Example of the in-memory Obsidian test kit (docs/framework/testing/OBSIDIAN-TEST-KIT.md): the real plugin
// entry loads against a fake vault and workspace seeded from the real-Obsidian fixture vault.
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App } from 'obsidian';
import { createTestApp, loadVaultFixtures } from '@test/obsidian';
import GeneratedPlugin from "../../main.ts";
import manifest from "../../../../manifest.json";

afterEach(() => { document.body.replaceChildren(); });

it('does not register stale views when unloaded during asynchronous startup', async () => {
  const app = new App(); const kit = createTestApp({ app });
  const stale = new GeneratedPlugin(app, manifest); let release = (_value: boolean) => {};
  const read = vi.spyOn(kit.app.vault.adapter, 'exists').mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const loading = kit.loadPlugin(stale); await vi.waitFor(() => expect(read).toHaveBeenCalled());
  await kit.unloadPlugin(stale); release(false); await loading;
  expect([...kit.app.viewRegistry.viewByType.keys()].filter(type => type.startsWith('coforge-'))).toEqual([]);
  expect(kit.app.statusBarEl.querySelectorAll('.coforge-native-statusbar')).toHaveLength(0);
  const fresh = new GeneratedPlugin(app, manifest); await kit.loadPlugin(fresh);
  expect(kit.app.viewRegistry.viewByType.has('coforge-view-stream-kanban')).toBe(true);
  await kit.unloadPlugin(fresh); expect(kit.errors).toEqual([]);
});

it('loads in Obsidian, opens its workbench, toggles debug logging and unloads without touching notes', async () => {
  // A path, not `new URL(..., import.meta.url)`: Vite rewrites that pattern to http: URLs under happy-dom.
  const files = loadVaultFixtures(join(import.meta.dirname, "../../../../tooling/tests/obsidian/vault"));
  const app = new App(); const kit = createTestApp({ app, files });
  const plugin = new GeneratedPlugin(app, manifest);
  await kit.loadPlugin(plugin);
  const ids = kit.commands().map(command => command.id);
  expect(ids).toEqual(expect.arrayContaining(['open-project', 'debug-toggle', 'debug-report'].map(id => `${manifest.id}:${id}`)));

  expect(await kit.runCommand('open-project')).toBe(true);
  await vi.waitFor(() => expect(app.workspace.getLeavesOfType(`${manifest.id}-view-project-workbench`)).toHaveLength(1));
  const [leaf] = app.workspace.getLeavesOfType(`${manifest.id}-view-project-workbench`);
  await vi.waitFor(() => expect(leaf?.view.containerEl.querySelector('.generated-workbench')).not.toBeNull());
  expect(leaf?.view.containerEl.querySelector('.cf-statusbar')).toBeNull();
  expect(kit.app.statusBarEl.querySelectorAll('.coforge-native-statusbar')).toHaveLength(1);

  expect(await kit.runCommand('debug-toggle')).toBe(true);
  expect(kit.notices.map(notice => notice.message)).toContain('Debug logging enabled for this session.');

  await kit.unloadPlugin(plugin);
  expect(kit.app.statusBarEl.querySelectorAll('.coforge-native-statusbar')).toHaveLength(0);
  expect(kit.commands()).toEqual([]);
  for (const [path, content] of Object.entries(files)) expect(kit.read(path)).toBe(content);
  expect(kit.errors).toEqual([]);
});
