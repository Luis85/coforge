import { afterEach } from 'vitest';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StageInput } from '../../../src/plugin/features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../../src/plugin/features/coforge/application/workflow-workspace-ports';
import type { WorkflowVerificationRecord, WorkflowVerificationRuntimeRecord } from '../../../src/plugin/features/coforge/domain/workflow-verification';
import type { WorkflowVerificationProfile } from '../../../src/plugin/features/coforge/domain/native-workflow-tools';
import { createSeed, defaultIntegration, defaultSettings } from '../../../src/plugin/features/coforge/domain/seed';
import { createWorkflowVerification, type WorkflowVerificationSession } from '../../../src/plugin/infrastructure/coforge/verification/session';
import { recoverVerificationRuntime, verificationDirectory } from '../../../src/plugin/infrastructure/coforge/verification/runtime';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

export function provisionedImage(): string {
  const image = process.env.COFORGE_VERIFICATION_IMAGE ?? '';
  if (!/^sha256:[a-f0-9]{64}$/u.test(image)) throw new Error('Real Docker qualification requires an explicitly provisioned COFORGE_VERIFICATION_IMAGE. No acceptance test is skipped.');
  return image;
}

export const CHECK_SCRIPT = `const fs=require('node:fs'); const assert=require('node:assert/strict');
fs.writeFileSync('private-test-write.txt','only the private test copy');
assert.equal(require('./feature.cjs'),require('fixture-dependency'));
console.log('Observed fixture check passed');`;

export async function verificationFixture(script = CHECK_SCRIPT, options: { timeoutSeconds?: number; maxRuns?: number } = {}) {
  const imageId = provisionedImage();
  const nq = resolve('.nq'); await mkdir(nq, { recursive: true });
  const directory = await mkdtemp(join(nq, 'workflow-verification-'));
  const source = join(directory, 'repository'); const outside = join(directory, 'outside');
  await mkdir(join(source, 'Managed'), { recursive: true }); await mkdir(outside);
  await mkdir(join(source, '.git'));
  await mkdir(join(source, 'node_modules/fixture-dependency'), { recursive: true });
  await writeFile(join(source, 'feature.cjs'), 'module.exports=1;\n');
  await writeFile(join(source, 'check.cjs'), script);
  await writeFile(join(source, 'preload.cjs'), `const fs=require('node:fs'); if(process.getuid()===0)fs.writeFileSync('/tmp/privileged-preload-ran','unsafe root preload'); console.log('UNSAFE_IMAGE_PRELOAD_EXECUTED');`);
  await writeFile(join(source, '.env'), 'COFORGE_FIXTURE_PRIVATE_ENV=do-not-copy\n');
  await writeFile(join(source, '.git/config'), 'PRIVATE_GIT_AUTH_CANARY\n');
  await writeFile(join(source, 'Managed/Note.md'), 'PRIVATE_CANONICAL_NOTE\n');
  await writeFile(join(outside, 'host-canary.txt'), 'HOST_OUTSIDE_CANARY\n');
  await writeFile(join(source, 'node_modules/fixture-dependency/index.js'), 'module.exports=999;\n');
  await writeFile(join(source, 'node_modules/fixture-dependency/package.json'), JSON.stringify({ name: 'fixture-dependency', main: 'index.js' }));
  const profile: WorkflowVerificationProfile = { enabled: true, dockerBin: process.env.COFORGE_VERIFICATION_DOCKER ?? 'docker', imageId,
    commands: [{ id: 'check', label: 'Isolated fixture checks', executable: 'node', args: ['check.cjs'] }], timeoutSeconds: options.timeoutSeconds ?? 5, maxRuns: options.maxRuns ?? 4 };
  const records: WorkflowVerificationRecord[] = []; const runtime: WorkflowVerificationRuntimeRecord[] = [];
  const runId = randomUUID(); const attemptId = randomUUID(); const workspaceId = randomUUID();
  const input: StageInput = { stage: 'implement', jobId: randomUUID(), idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' },
    settings: { ...defaultSettings(), provider: 'codex', timeoutSeconds: 60, maxTurns: 20 }, integration: { ...defaultIntegration(), projectPath: source, allowImplementation: true },
    workflow: { runId, attemptId, workspaceId, proposalRevision: 'fixture-proposal', definitionRevision: 'fixture-definition', inputArtifacts: [],
      step: { id: 'build', name: 'Fixture native Build', kind: 'ai', output: 'codechange', access: 'editworktree', provider: 'codex', model: 'gpt-6.1-sol', instructions: 'Fixture provider uses scoped MCP only.', automatic: false,
        nativeTools: { delegation: { maxConcurrent: 2 }, verification: { commandIds: ['check'] } } }, verificationProfile: profile },
    onVerification: async record => {
      records.push(structuredClone(record));
      await writeFile(join(directory, 'observed-records.json'), JSON.stringify(records));
    },
    onVerificationRuntime: async record => {
      if (!records.some(value => value.id === record.verificationId && value.status === 'running')) throw new Error('Container creation preceded durable running evidence.');
      runtime.push(structuredClone(record));
      await writeFile(join(directory, 'private-runtime.json'), JSON.stringify(runtime));
    },
  };
  const lease: WorkflowWorkspaceLease = { id: workspaceId, cwd: source, protectedProjectPaths: ['Managed'], validate: async () => {
    if (await realpath(source) !== source) throw new Error('The fixture source identity changed.');
  }, capture: async summary => ({ summary, simulated: false, createdAt: new Date().toISOString(), files: [{ path: 'feature.cjs', additions: 1, deletions: 1 }], tests: ['Not run: shell tools are disabled.'], diff: await readFile(join(source, 'feature.cjs'), 'utf8') }), release: async () => {} };
  let session: WorkflowVerificationSession | undefined;
  const closeables: Array<() => Promise<void>> = [];
  const open = async () => { session = await createWorkflowVerification(input, lease); if (!session) throw new Error('The fixture verification profile was not admitted.'); return session; };
  cleanup.push(async () => {
    for (const close of closeables.reverse()) await close();
    await session?.dispose().catch(() => undefined);
    const latest = new Map(runtime.map(record => [record.verificationId, record]));
    for (const record of latest.values()) if (record.phase !== 'terminal' && await recoverVerificationRuntime(record) !== 'terminal') throw new Error('The original owned verification container could not be proven stopped. Evidence retained.');
    if (dirname(directory) !== nq || !basename(directory).startsWith('workflow-verification-')) throw new Error('Refusing fixture cleanup outside its contained root.');
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, source, outside, input, lease, profile, records, runtime, open, closeables,
    currentRuntime: () => runtime.at(-1),
    assertSourceUnchanged: async () => {
      if (await readFile(join(source, '.env'), 'utf8') !== 'COFORGE_FIXTURE_PRIVATE_ENV=do-not-copy\n' || await readFile(join(source, 'Managed/Note.md'), 'utf8') !== 'PRIVATE_CANONICAL_NOTE\n' || await readFile(join(outside, 'host-canary.txt'), 'utf8') !== 'HOST_OUTSIDE_CANARY\n') throw new Error('Canonical fixture data changed.');
    },
    verificationDirectory,
  };
}
