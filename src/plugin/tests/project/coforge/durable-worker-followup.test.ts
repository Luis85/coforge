import { expect, it, vi } from 'vitest';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { createDurableBuildClient, durableBuildWorkspaces } from '../../../infrastructure/coforge/durable-build-client';

it('lets a no-access follow-up use an isolated lease without inheriting a background file capability', async () => {
  const lease = { cwd: 'isolated-no-tools', capture: async () => undefined, release: async () => {} };
  const fallback: WorkflowWorkspaces = { start: async () => {}, acquire: vi.fn(async () => lease), assertReviewable: async () => {}, acknowledge: async () => {} };
  const client = createDurableBuildClient({ workerSource: '', privateDirectory: 'unused-no-io' });
  const workspaces = durableBuildWorkspaces(client, fallback);
  const request = { runId: 'run-one', projectId: 'project-one', attemptId: 'summary', access: 'none' as const, workspaceId: 'bg-original', integration: defaultIntegration() };
  expect(await workspaces.acquire(request)).toBe(lease);
  expect(fallback.acquire).toHaveBeenCalledWith({ ...request, workspaceId: undefined });
  await expect(async () => workspaces.acquire({ ...request, access: 'editworktree' })).rejects.toThrow('background worker');
  expect(fallback.acquire).toHaveBeenCalledTimes(1);
});
