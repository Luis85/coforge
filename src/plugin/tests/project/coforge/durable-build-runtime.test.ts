// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import type { WorkflowWorkspaceStorage } from '../../../features/coforge/application/workflow-workspace-ports';
import { LocalWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspaces';
vi.mock('obsidian', () => import('@test/obsidian'));
const fixtures = vi.hoisted(() => {
  const retries = { inspect: vi.fn(), verify: vi.fn() };
  const polishing = { materialize: vi.fn() };
  const worker = {
  readiness: vi.fn(async () => ({ ready: true, message: 'Verified fixture worker; no Build admitted.' })),
  prepare: vi.fn(), start: vi.fn(), inspect: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(),
  configureConcurrency: vi.fn(async () => {}), detach: vi.fn(async () => {}),
  ownsWorkspace: () => false, assertReviewable: vi.fn(), acknowledgeWorkspace: vi.fn(),
  retryResources: vi.fn((_storage: WorkflowWorkspaceStorage) => retries),
  polishingResources: vi.fn((_workspaces: LocalWorkflowWorkspaces, _storage: WorkflowWorkspaceStorage) => polishing),
  };
  return { worker, retries, polishing };
});
const { worker } = fixtures;
vi.mock('../../../infrastructure/coforge/durable-build-runtime', () => ({ durableBuildRuntime: () => worker }));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { createCoforgeRuntime } from '../../../infrastructure/coforge/runtime';

it('connects the studio to the background worker without admitting a Build during readiness', async () => {
  const app = new App(); createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const runtime = createCoforgeRuntime(plugin, () => {});
  try {
    expect(worker.retryResources).toHaveBeenCalledOnce();
    expect(worker.polishingResources).toHaveBeenCalledOnce();
    const retryStorage = worker.retryResources.mock.calls[0]![0];
    const [primaryWorkspaces, polishingStorage] = worker.polishingResources.mock.calls[0]!;
    expect(primaryWorkspaces).toBeInstanceOf(LocalWorkflowWorkspaces);
    expect(polishingStorage).toBe(retryStorage);
    await runtime.studio.store.init();
    expect(await runtime.studio.refreshDurableBuildRuntime()).toMatchObject({ ready: true });
    expect(runtime.studio.state().runtime.durableBuild?.message).toContain('no Build admitted');
    expect(worker.prepare).not.toHaveBeenCalled(); expect(worker.start).not.toHaveBeenCalled();
    expect(fixtures.retries.inspect).not.toHaveBeenCalled(); expect(fixtures.retries.verify).not.toHaveBeenCalled(); expect(fixtures.polishing.materialize).not.toHaveBeenCalled();
  } finally { await runtime.dispose(); }
});
