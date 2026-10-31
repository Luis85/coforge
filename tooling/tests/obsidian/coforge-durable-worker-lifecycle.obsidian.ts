import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { expect, it } from 'vitest';
import { createObsidianSession, provisionHost, requestedAppVersion } from '../../testing/obsidian-harness.mjs';
import { caseDirectory, sourceCommit, writeEvidence } from './support/evidence';
import { agentGit } from '../../../src/plugin/infrastructure/coforge/agent-worktree';
import { createDurableBuildClient } from '../../../src/plugin/infrastructure/coforge/durable-build-client';
import { nativeIdentityCheck } from '../../../src/plugin/infrastructure/coforge/durable-worker/store';
import { stopOwnedProcessTree, type NativeProcessIdentity } from '../../../src/plugin/infrastructure/coforge/durable-worker/process-identity';
import { durableBuildRefCheck, durableBuildSnapshotCheck } from '../../../src/plugin/features/coforge/domain/durable-build';
import { number, shape, text } from '../../../src/plugin/features/coforge/domain/check';
import { durableRequest } from '../../../src/plugin/tests/project/coforge/durable-worker-fixture';

async function cleanup(sessions: Array<ReturnType<typeof createObsidianSession>>, identity: NativeProcessIdentity | undefined, root: string, failure: unknown): Promise<void> {
  const closed = await Promise.allSettled(sessions.reverse().map(session => session.close()));
  const errors: unknown[] = closed.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  if (identity) {
    const proof = await stopOwnedProcessTree(identity);
    if (!proof.treeConfirmed && proof.state !== 'absent' && proof.state !== 'different') errors.push(new Error('Synthetic worker teardown remains unverified.'));
  }
  if (!errors.length) await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  if (errors.length) throw new AggregateError([...(failure ? [failure] : []), ...errors], 'Contained native lifecycle cleanup failed; evidence was preserved.');
}

it('keeps the original native worker after real Obsidian quits and reconnects from a new host without a second admission', async ({ signal }) => {
  const evidence = await caseDirectory('coforge-durable-worker-lifecycle.obsidian.ts', 'original-worker-survives-native-quit');
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'native-worker-')));
  if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe native worker fixture cleanup');
  const sessions: Array<ReturnType<typeof createObsidianSession>> = []; let identity: NativeProcessIdentity | undefined; let failure: unknown;
  const abort = () => { void Promise.allSettled(sessions.map(session => session.close())); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const game = join(root, 'game'); const vault = join(root, 'vault-boundary'); await mkdir(game); await mkdir(vault);
    await agentGit(game, ['init', '--initial-branch=main']); await writeFile(join(game, 'README.md'), 'Contained lifecycle fixture\n'); await agentGit(game, ['add', 'README.md']);
    await agentGit(game, ['-c', 'user.name=CoForge fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Contained fixture']);
    const entry = resolve('src/plugin/infrastructure/coforge/durable-worker/runtime.ts').replaceAll('\\', '/');
    const worker = await build({ stdin: { contents: `import {main} from ${JSON.stringify(entry)};import {appendFile,access} from 'node:fs/promises';import {join} from 'node:path';
      setTimeout(()=>process.exit(0),120000).unref();void main(process.argv[3],async(request)=>{
        await appendFile(join(process.argv[3],'admissions.txt'),request.jobId+'\\n');
        for(;;){try{await access(join(process.argv[3],'finish-fixture'));break}catch{}await new Promise(done=>setTimeout(done,30));}
        return {summary:'Completed after the actual host exited'};
      });`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', write: false, logLevel: 'silent' });
    const clientPath = resolve('src/plugin/infrastructure/coforge/durable-build-client.ts').replaceAll('\\', '/');
    const helper = join(root, 'native-fixture.cjs');
    await build({ stdin: { contents: `import {createDurableBuildClient} from ${JSON.stringify(clientPath)};
      const client=(options)=>createDurableBuildClient({...options,protectedVaultFolders:()=>['CoForge','.obsidian']});
      export async function admit(options,request){const value=client(options);const ref=await value.prepare(request);return {ref,snapshot:await value.start(ref)}}
      export async function inspect(options,ref){return client(options).inspect(ref)}`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: helper, logLevel: 'silent' });
    const options = { privateDirectory: join(root, 'private'), workerSource: worker.outputFiles[0]!.text, nodeExecutable: process.execPath, vaultDirectory: vault };
    const request = durableRequest(); request.input.integration.projectPath = game;
    const host = await provisionHost({ allowDownload: false, appVersion: requestedAppVersion() });
    await writeEvidence(evidence, 'environment', { runner: 'vitest real-obsidian', commit: sourceCommit(), appVersion: host.appVersion, launcherVersion: host.launcherVersion, platform: process.platform, node: process.version });
    const first = createObsidianSession({ host, chromium, vaultSource: 'tooling/tests/obsidian/vault' }); sessions.push(first); const original = await first.start();
    const admitted = shape({ ref: durableBuildRefCheck, snapshot: durableBuildSnapshotCheck })(await original.page.evaluate(async ({ helper, options, request }) => {
      const load = globalThis.require; const api: unknown = load(helper);
      if (!api || typeof api !== 'object' || !('admit' in api) || typeof api.admit !== 'function') throw new Error('Contained native fixture unavailable');
      return api.admit(options, request);
    }, { helper, options, request }));
    const daemon = shape({ pid: number({ integer: true, min: 1 }), workerId: text(), identity: nativeIdentityCheck })(JSON.parse(await readFile(join(options.privateDirectory, 'daemon.json'), 'utf8')));
    expect(daemon.workerId).toBe(admitted.ref.workerId); expect(daemon.identity.pid).toBe(daemon.pid); identity = daemon.identity;
    const observer = createDurableBuildClient({ ...options, protectedVaultFolders: () => ['CoForge', '.obsidian'] });
    await expect.poll(() => readFile(join(options.privateDirectory, 'admissions.txt'), 'utf8').catch(() => ''), { timeout: 15000 }).toBe(request.jobId + '\n');
    await writeEvidence(evidence, 'admitted', { status: 'running', execution: admitted.ref, native: first.evidence() });
    // Ask Electron to quit normally. The fixture's emergency tree termination is not continuation evidence.
    const protocol = await original.browser.newBrowserCDPSession(); void protocol.send('Browser.close').catch(() => undefined);
    await expect.poll(() => original.proc.exitCode !== null || original.proc.signalCode !== null, { timeout: 15000 }).toBe(true);
    expect((await observer.inspect(admitted.ref)).phase).toBe('running');
    await writeFile(join(options.privateDirectory, 'finish-fixture'), 'finish only after the host exited');
    await expect.poll(async () => (await observer.inspect(admitted.ref)).phase, { timeout: 15000 }).toBe('completed');
    await first.close();
    const reopened = createObsidianSession({ host, chromium, vaultSource: 'tooling/tests/obsidian/vault' }); sessions.push(reopened); const current = await reopened.start();
    const result = durableBuildSnapshotCheck(await current.page.evaluate(async ({ helper, options, ref }) => {
      const load = globalThis.require; const api: unknown = load(helper);
      if (!api || typeof api !== 'object' || !('inspect' in api) || typeof api.inspect !== 'function') throw new Error('Contained native fixture unavailable');
      return api.inspect(options, ref);
    }, { helper, options, ref: admitted.ref }));
    expect(result.phase).toBe('completed'); expect(result.ref).toEqual(admitted.ref);
    expect(await readFile(join(options.privateDirectory, 'admissions.txt'), 'utf8')).toBe(request.jobId + '\n');
    await writeEvidence(evidence, 'continuation', { status: 'passed', commit: sourceCommit(), host: { appVersion: host.appVersion, launcherVersion: host.launcherVersion }, platform: process.platform,
      nativeHostExit: { code: original.proc.exitCode, signal: original.proc.signalCode }, originalExecution: admitted.ref, phase: result.phase, providerAdmissions: 1, paidProvider: false, productionTestHook: false });
  } catch (error) { failure = error; throw error; }
  finally {
    signal.removeEventListener('abort', abort);
    await cleanup(sessions, identity, root, failure);
    await writeEvidence(evidence, 'teardown', { completed: true, testState: failure ? 'failed' : 'passed', ownedSessions: sessions.map(session => session.evidence()) });
  }
}, 180000);
