// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { createCoforgeRuntime } from '../../../infrastructure/coforge/runtime';

it('keeps event and scheduled admission unavailable until workflow recovery finishes', async () => {
  const app = new App();
  createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, {
    id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '',
  });
  const runtime = createCoforgeRuntime(plugin, () => undefined);
  const originalExists = app.vault.adapter.exists.bind(app.vault.adapter);
  let release = () => {};
  let loadingRecovery = false;
  const held = new Promise<boolean>(resolve => { release = () => resolve(false); });
  const exists = vi.spyOn(app.vault.adapter, 'exists').mockImplementation(path => {
    if (path.endsWith('/coforge-herdr-workflow.json')) { loadingRecovery = true; return held; }
    return originalExists(path);
  });
  const startup = runtime.start();
  try {
    await vi.waitFor(() => expect(loadingRecovery).toBe(true));
    expect(runtime.host.taskScheduler?.snapshot().ready).toBe(false);
    expect(runtime.host.workflowTriggers?.snapshot().ready).toBe(false);
    expect(runtime.studio.state().jobs).toEqual([]);
    release();
    await startup;
    expect(runtime.host.taskScheduler?.snapshot().ready).toBe(true);
    expect(runtime.host.workflowTriggers?.snapshot().ready).toBe(true);
    expect(runtime.studio.state().jobs).toEqual([]);
  } finally {
    release(); await startup; await runtime.dispose(); exists.mockRestore();
  }
});
