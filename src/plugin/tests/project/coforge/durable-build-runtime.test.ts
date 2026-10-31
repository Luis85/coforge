// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
const worker = vi.hoisted(() => ({
  readiness: vi.fn(async () => ({ ready: true, message: 'Verified fixture worker; no Build admitted.' })),
  prepare: vi.fn(), start: vi.fn(), inspect: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(),
  configureConcurrency: vi.fn(async () => {}), detach: vi.fn(async () => {}),
  ownsWorkspace: () => false, assertReviewable: vi.fn(), acknowledgeWorkspace: vi.fn(),
}));
vi.mock('../../../infrastructure/coforge/durable-build-runtime', () => ({ durableBuildRuntime: () => worker }));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { createCoforgeRuntime } from '../../../infrastructure/coforge/runtime';

it('connects the studio to the background worker without admitting a Build during readiness', async () => {
  const app = new App(); createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const runtime = createCoforgeRuntime(plugin, () => {});
  try {
    await runtime.studio.store.init();
    expect(await runtime.studio.refreshDurableBuildRuntime()).toMatchObject({ ready: true });
    expect(runtime.studio.state().runtime.durableBuild?.message).toContain('no Build admitted');
    expect(worker.prepare).not.toHaveBeenCalled(); expect(worker.start).not.toHaveBeenCalled();
  } finally { await runtime.dispose(); }
});
