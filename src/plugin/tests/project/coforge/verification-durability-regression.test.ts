import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createWorkflowVerification } from '../../../infrastructure/coforge/verification/session';
import { removeVerificationDirectory } from '../../../infrastructure/coforge/verification/runtime';
import type { VerificationBackend } from '../../../infrastructure/coforge/verification/docker-execution';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { ProcessOwnershipUnknown } from '../../../infrastructure/coforge/process';

const folders: string[] = []; const snapshots: string[] = [];
afterEach(async () => { await Promise.all(snapshots.splice(0).map(id => removeVerificationDirectory(id))); await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
it.each(['public outcome', 'private lifecycle'] as const)('fences another execution and completion after a %s persistence failure', async failure => {
  await mkdir('.nq', { recursive: true }); const root = await mkdtemp(join(process.cwd(), '.nq/verification-durable-failure-')); folders.push(root);
  await writeFile(join(root, 'source.js'), 'fixture');
  const input: StageInput = { stage: 'implement', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' }, integration: { ...defaultIntegration(), projectPath: root }, settings: defaultSettings(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'revision', proposalRevision: 'proposal', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', provider: 'claude', model: 'sonnet', automatic: false, output: 'codechange', access: 'editworktree', instructions: 'Verify', nativeTools: { verification: { commandIds: ['check'] } } },
      verificationProfile: { enabled: true, dockerBin: 'docker', imageId: 'sha256:' + 'a'.repeat(64), timeoutSeconds: 5, maxRuns: 2, commands: [{ id: 'check', label: 'Checks', executable: 'node', args: ['--test'] }] } },
    onVerification: async record => { if (failure === 'public outcome' && record.status === 'completed') throw new Error('Public outcome could not persist'); },
    onVerificationRuntime: async record => { if (failure === 'private lifecycle' && record.phase === 'started') throw new Error('Private lifecycle could not persist'); } };
  const execute: VerificationBackend['execute'] = vi.fn(async (_profile, _command, identity, lifecycle) => {
    snapshots.push(identity.verificationId);
    const runtime = { ...identity, ownerToken: 'b'.repeat(64), containerName: `coforge-verification-${identity.verificationId}`, phase: 'prepared' as const, startedAt: new Date().toISOString() };
    await lifecycle(runtime); await lifecycle({ ...runtime, phase: 'started' });
    await lifecycle({ ...runtime, phase: 'terminal', terminalAt: new Date().toISOString() });
    return { output: 'observed completion', truncated: false, interrupted: false, exitCode: 0, unknown: false };
  });
  const session = await createWorkflowVerification(input, { cwd: root, protectedProjectPaths: [], capture: async () => undefined, release: async () => {} },
    { prepare: async () => 'unix:///var/run/docker.sock', execute });
  if (!session) throw new Error('Verification session missing.');
  await expect(session.run({ commandId: 'check' })).rejects.toThrow('persist');
  await expect(session.run({ commandId: 'check' })).rejects.toThrow(/closed|recovery/u);
  expect(execute).toHaveBeenCalledOnce();
  await expect(session.dispose()).rejects.toBeInstanceOf(ProcessOwnershipUnknown);
});
