import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { DockerVerificationBackend } from '../../../infrastructure/coforge/verification/docker-execution';
import { localDockerEndpoint, prepareVerificationDirectory, recoverVerificationRuntime, removeVerificationDirectory, verificationContainerName, verificationLabels, type VerificationCapture } from '../../../infrastructure/coforge/verification/runtime';
import type { WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';

const imageId = 'sha256:' + 'a'.repeat(64);
it('refuses remote engines before any source can be mounted', async () => {
  const capture = vi.fn(async () => JSON.stringify('tcp://example.invalid:2375'));
  const backend = new DockerVerificationBackend(capture);
  await expect(backend.prepare({ enabled: true, dockerBin: 'docker', imageId, commands: [], maxRuns: 1, timeoutSeconds: 5 })).rejects.toThrow(/local/u);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(localDockerEndpoint('ssh://host')).toBe(false);
});
it('does not treat a created-but-never-started container with default exit zero as a completed command', async () => {
  const id = randomUUID(); const directory = await prepareVerificationDirectory(id); await mkdir(join(directory, 'source'));
  const calls: string[][] = []; let runtime: WorkflowVerificationRuntimeRecord | undefined; let removed = false;
  const capture: VerificationCapture = async (_executable, args) => {
    calls.push([...args]);
    if (args.includes('context')) return JSON.stringify('unix:///var/run/docker.sock');
    if (args.includes('info')) return JSON.stringify({ OSType: 'linux' });
    if (args.includes('image')) return JSON.stringify([{ Id: imageId, Os: 'linux', Config: { Env: ['NODE_OPTIONS=--require=/source/preload.cjs', 'PATH=/source'], Volumes: null } }]);
    if (args.includes('create')) return 'owned-container-id';
    if (args.includes('rm')) { removed = true; return 'removed'; }
    if (args.includes('ls')) return '';
    if (args.includes('inspect')) {
      if (removed || !runtime) throw new Error('missing');
      return JSON.stringify([{ Name: '/' + runtime.containerName, Image: imageId, Config: { Labels: verificationLabels(runtime), User: '0:0' },
        State: { Running: false, Status: 'created', StartedAt: '0001-01-01T00:00:00Z', FinishedAt: '0001-01-01T00:00:00Z', ExitCode: 0 },
        HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, Privileged: false, CapDrop: ['ALL'], CapAdd: ['SETUID', 'SETGID', 'KILL'], SecurityOpt: ['no-new-privileges'], PidsLimit: 128, Memory: 1073741824, NanoCpus: 2000000000, Tmpfs: { '/tmp': '', '/work': '' } },
        Mounts: [['source', '/source'], ['runner.cjs', '/coforge/runner.cjs'], ['command.json', '/coforge/command.json']].map(([source, target]) => ({ Type: 'bind', Source: join(directory, source!), Destination: target, RW: false })) }]);
    }
    throw new Error('Unexpected control command.');
  };
  const backend = new DockerVerificationBackend(capture, async () => ({ output: '', interrupted: false, truncated: false }));
  const profile = { enabled: true, dockerBin: 'docker', imageId, commands: [], maxRuns: 1, timeoutSeconds: 5 };
  try {
    const endpoint = await backend.prepare(profile);
    const outcome = await backend.execute(profile, { id: 'check', label: 'Checks', executable: 'node', args: ['--test'] }, { verificationId: id, endpoint, dockerBin: 'docker', imageId, runId: 'run', attemptId: 'attempt', projectId: 'project', sourceDirectory: directory, sourceHash: 'b'.repeat(64), commandId: 'check' }, async record => { runtime = record; });
    expect(outcome.unknown).toBe(false); expect(outcome.exitCode).toBeUndefined();
    expect(runtime?.phase).toBe('terminal');
    const create = calls.find(args => args.includes('create'))!;
    expect(create).toContain('NODE_OPTIONS='); expect(create).toContain('PATH=/usr/local/bin:/usr/bin:/bin');
    expect(create).toContain('/usr/local/bin/node'); expect(create).toContain('--no-healthcheck'); expect(create).not.toContain('CHOWN');
  } finally { await removeVerificationDirectory(id); }
});
it('refuses to stop a same-name container with different retained ownership', async () => {
  const id = randomUUID(); const directory = await prepareVerificationDirectory(id);
  const runtime: WorkflowVerificationRuntimeRecord = { verificationId: id, containerName: verificationContainerName(id), ownerToken: 'a'.repeat(64), endpoint: 'unix:///var/run/docker.sock', dockerBin: 'docker', imageId, runId: 'run', attemptId: 'attempt', projectId: 'project', sourceDirectory: directory, sourceHash: 'b'.repeat(64), commandId: 'check', phase: 'started', startedAt: new Date().toISOString() };
  const capture = vi.fn(async () => JSON.stringify([{ Name: '/' + runtime.containerName, Image: imageId, Config: { Labels: { ...verificationLabels(runtime), 'coforge.verification.owner': 'foreign' } }, State: { Running: true, Status: 'running', StartedAt: runtime.startedAt, FinishedAt: '0001-01-01T00:00:00Z', ExitCode: 0 }, HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true }, Mounts: [] }]));
  try { expect(await recoverVerificationRuntime(runtime, capture)).toBe('unknown'); expect(capture).toHaveBeenCalledTimes(1); }
  finally { await removeVerificationDirectory(id); }
});
