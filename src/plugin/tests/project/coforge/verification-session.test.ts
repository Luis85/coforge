import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createWorkflowVerification } from '../../../infrastructure/coforge/verification/session';
import type { VerificationBackend } from '../../../infrastructure/coforge/verification/docker-execution';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowVerificationRecord, WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  await mkdir('.nq', { recursive: true }); const root = await mkdtemp(join(process.cwd(), '.nq/verification-session-')); roots.push(root);
  await writeFile(join(root, 'source.js'), 'original'); await writeFile(join(root, '.env'), 'PRIVATE');
  const records: WorkflowVerificationRecord[] = []; const runtime: WorkflowVerificationRuntimeRecord[] = []; const order: string[] = [];
  const input: StageInput = { stage: 'implement', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' }, integration: { ...defaultIntegration(), projectPath: root }, settings: defaultSettings(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'revision', proposalRevision: 'proposal', inputArtifacts: [], workspaceId: 'workspace',
      step: { id: 'build', name: 'Build', kind: 'ai', instructions: 'Build', output: 'codechange', access: 'editworktree', provider: 'claude', model: 'sonnet', automatic: false, nativeTools: { verification: { commandIds: ['check'] } } },
      verificationProfile: { enabled: true, dockerBin: 'docker', imageId: 'sha256:' + 'a'.repeat(64), timeoutSeconds: 5, maxRuns: 2, commands: [{ id: 'check', label: 'Checks', executable: 'node', args: ['--test'] }] } },
    onVerification: async record => { records.push(structuredClone(record)); order.push(record.status); }, onVerificationRuntime: async record => { runtime.push(structuredClone(record)); } };
  const lease = { id: 'workspace', cwd: root, protectedProjectPaths: [], validate: vi.fn(async () => {}), capture: async () => undefined, release: async () => {} };
  const backend: VerificationBackend = { prepare: vi.fn(async () => 'unix:///var/run/docker.sock'), execute: vi.fn(async (_profile, _command, identity, lifecycle) => {
    expect(order.at(-1)).toBe('running'); expect(await readFile(join(identity.sourceDirectory, 'source/source.js'), 'utf8')).toBe('original');
    await expect(readFile(join(identity.sourceDirectory, 'source/.env'))).rejects.toThrow();
    const record: WorkflowVerificationRuntimeRecord = { ...identity, containerName: `coforge-verification-${identity.verificationId}`, ownerToken: 'b'.repeat(64), phase: 'prepared', startedAt: new Date().toISOString() };
    await lifecycle(record); await lifecycle({ ...record, phase: 'terminal', terminalAt: new Date().toISOString() });
    return { output: 'observed check', truncated: false, interrupted: false, exitCode: 0, unknown: false };
  }) };
  return { root, input, lease, backend, records, runtime };
}
it('reserves actual command evidence before execution and binds outcomes to exact source bytes', async () => {
  const f = await fixture(); const session = await createWorkflowVerification(f.input, f.lease, f.backend);
  expect(session).toBeDefined(); if (!session) throw new Error('Verification session missing.');
  const result = await session.run({ commandId: 'check' });
  expect(result).toMatchObject({ status: 'completed', exitCode: 0, output: 'observed check' });
  expect(f.records.map(record => record.status)).toEqual(['running', 'completed']);
  expect(f.runtime.map(record => record.phase)).toEqual(['prepared', 'terminal']);
  const increment = { ...createSeed().ideas.find(idea => idea.increment)!.increment!, simulated: false, tests: ['Not run: shell tools are disabled.'] };
  const captured = await session.capture(increment);
  expect(captured.verificationSourceHash).toBe(result.sourceHash); expect(captured.verification).toEqual([result]);
  expect(captured.tests.join(' ')).not.toContain('Not run: shell tools');
  await writeFile(join(f.root, 'source.js'), 'changed');
  expect((await session.capture(increment)).verificationSourceHash).not.toBe(result.sourceHash);
  await session.dispose();
});
it('refuses unselected commands and run-limit escalation and leaves legacy invocations unchanged', async () => {
  const f = await fixture(); const session = await createWorkflowVerification(f.input, f.lease, f.backend);
  if (!session) throw new Error('Verification session missing.');
  await expect(session.run({ commandId: 'unapproved' })).rejects.toThrow();
  await expect(session.run({ commandId: 'check', args: ['arbitrary'] })).rejects.toThrow();
  await session.run({ commandId: 'check' }); await session.run({ commandId: 'check' });
  await expect(session.run({ commandId: 'check' })).rejects.toThrow(/limit/u);
  const legacy = { ...f.input, workflow: { ...f.input.workflow!, verificationProfile: undefined } };
  expect(await createWorkflowVerification(legacy, f.lease, f.backend)).toBeUndefined(); await session.dispose();
});
it('clips final normalized UTF-8 evidence per record and attempt without aborting healthy tests', async () => {
  const f = await fixture(); f.input.workflow!.verificationProfile!.maxRuns = 32;
  f.backend.execute = vi.fn(async () => ({ output: '界'.repeat(4000) + ' Bearer x', truncated: false, interrupted: false, exitCode: 0, unknown: false }));
  const session = await createWorkflowVerification(f.input, f.lease, f.backend); if (!session) throw new Error('Missing session.');
  for (let index = 0; index < 12; index++) { const record = await session.run({ commandId: 'check' }); expect(record.status).toBe('completed'); expect(Buffer.byteLength(record.output)).toBeLessThanOrEqual(8192); expect(record.truncated).toBe(true); }
  expect(session.records().reduce((sum, record) => sum + Buffer.byteLength(record.output), 0)).toBeLessThanOrEqual(65536);
  await session.dispose();
});
it('retains changed-file evidence and command history after the provider signal is aborted', async () => {
  const f = await fixture(); const controller = new AbortController(); f.input.signal = controller.signal;
  const session = await createWorkflowVerification(f.input, f.lease, f.backend); if (!session) throw new Error('Missing session.');
  const record = await session.run({ commandId: 'check' }); controller.abort(); await session.dispose();
  const increment = { ...createSeed().ideas.find(idea => idea.increment)!.increment!, simulated: false };
  const retained = await session.capture(increment);
  expect(retained.diff).toBe(increment.diff); expect(retained.files).toEqual(increment.files);
  expect(retained.verification).toEqual([record]); expect(retained.verificationSourceHash).toBe(record.sourceHash);
});
