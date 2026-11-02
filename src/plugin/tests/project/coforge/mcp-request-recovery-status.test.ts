import { afterEach, expect, it } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import { McpWorkflowTools } from '../../../infrastructure/coforge/mcp-workflow-tools';
import { createSeed } from '../../../features/coforge/domain/seed';
import { providerFailureFor } from '../../../features/coforge/domain/provider-failure';
import type { AgentJob } from '../../../features/coforge/domain/types';
import { MemoryStorage, nodeTimers } from './memory-storage';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function fixture() {
  const seed = createSeed(); seed.settings.paused = true; seed.jobs = [];
  const studio = new StudioService(new MemoryStorage(seed), { timers: nodeTimers(),
    runners: { demo: async () => { throw new Error('Status must never dispatch a model'); }, claude: async () => { throw new Error('Status must never dispatch a model'); } },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  const runner = new McpStepRunner({ start: async () => {}, acknowledge: async () => {}, assertReviewable: async () => {},
    acquire: async () => { throw new Error('Status must never acquire a workspace or dispatch work'); } }, nodeTimers());
  await studio.start(); stops.push(async () => { await runner.dispose(); await studio.stop(); });
  const idea = studio.state().ideas[0]!, projectId = studio.state().activeProjectId!;
  const tools = new McpWorkflowTools(studio, runner);
  const job: AgentJob = { id: 'original', ideaId: idea.id, projectId, stage: 'plan', provider: 'claude', status: 'failed',
    startedAt: new Date().toISOString(), logs: [], failure: providerFailureFor('incomplete_output', true) };
  const save = async (jobs: AgentJob[]) => studio.store.transaction(state => { state.jobs = jobs; });
  const status = () => tools.call(projectId, 'coforge_request_status', { ideaId: idea.id });
  return { job, save, status };
}
const originalProcess = () => ({ runId: 'run', attemptId: 'attempt', projectId: 'CFP-001',
  identity: { pid: 123, platform: 'linux', groupId: 123, birth: 'private-birth', image: 'a'.repeat(64) },
  phase: 'launched' as const, observedAt: new Date().toISOString() });

it('reports retained safe-catalogue ownership uncertainty even without an original process record', async () => {
  const f = await fixture(); await f.save([f.job]);
  expect(await f.status()).toMatchObject({ operatorRecoveryRequired: true, attempt: { failure: { code: 'incomplete_output' } } });
});

it('keeps earlier unresolved native preparation visible when a newer attempt succeeded without leaking its private handle', async () => {
  const f = await fixture();
  const nativeRuntime = { runId: 'run', attemptId: 'attempt', projectId: f.job.projectId!, directory: '/private/retained-runtime', ownerToken: 'b'.repeat(64) };
  await f.save([{ ...f.job, failure: undefined, nativeRuntime }, { ...f.job, id: 'newer', status: 'succeeded', failure: undefined }]);
  const status = await f.status();
  expect(status).toMatchObject({ operatorRecoveryRequired: true, attempt: { taskId: 'newer', status: 'succeeded' } });
  expect(JSON.stringify(status)).not.toMatch(/retained-runtime|ownerToken|bbbbbbbb/);
});

it('reports an unsettled original launch on a terminal attempt', async () => {
  const f = await fixture(); await f.save([{ ...f.job, failure: undefined, nativeProcess: originalProcess() }]);
  expect(await f.status()).toMatchObject({ operatorRecoveryRequired: true });
});

it('respects acknowledged original-process authority rather than treating an historical failure as a fresh hold', async () => {
  const f = await fixture(); await f.save([{ ...f.job, failure: providerFailureFor('ownership_unknown'),
    nativeProcess: { ...originalProcess(), phase: 'unknown', operatorAcknowledgedAt: new Date().toISOString() } }]);
  expect(await f.status()).toMatchObject({ operatorRecoveryRequired: false });
});

it('does not turn a legitimately running native session into an operator recovery action', async () => {
  const f = await fixture(); await f.save([{ ...f.job, failure: undefined, status: 'running', nativeProcess: originalProcess() }]);
  expect(await f.status()).toMatchObject({ operatorRecoveryRequired: false, attempt: { status: 'running' } });
});

it('keeps MCP recovery under its existing external-client and workspace authority', async () => {
  const f = await fixture(); await f.save([{ ...f.job, provider: 'mcp' }]);
  expect(await f.status()).toMatchObject({ operatorRecoveryRequired: false });
});

it('reports active durable attention while its running job still reserves the execution lane', async () => {
  const f = await fixture();
  const ref = { version: 1 as const, executionId: 'execution', workerId: 'worker', epoch: 1, inputHash: 'c'.repeat(64) };
  await f.save([{ ...f.job, status: 'running', failure: undefined, durable: { intent: 'start', ref, policy: { mode: 'background' },
    snapshot: { version: 1, ref, sequence: 1, phase: 'attention', createdAt: f.job.startedAt, lastContactAt: f.job.startedAt, elapsedSeconds: 0, logs: [] } } }]);
  expect(await f.status()).toMatchObject({ operatorRecoveryRequired: true, attempt: { status: 'running' } });
});
