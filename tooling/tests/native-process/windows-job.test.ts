import { afterEach, expect, it } from 'vitest';
import { setTimeout as pause } from 'node:timers/promises';
import { captureProcess, ProcessFailure } from '../../../src/plugin/infrastructure/coforge/process';
import type { NativeWorkflowLifetimeRef } from '../../../src/plugin/features/coforge/domain/native-workflow-lifetime';
import { cleanupNativeFixtures, nativeProcessFixture } from './fixture';
import { startOwnedWorktreeProcess, inspectOwnedWorktreeLifetime, recoverOwnedWorktreeLifetime } from '../../../src/plugin/infrastructure/coforge/native-process/owned-worktree-process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { shape } from '../../../src/plugin/features/coforge/domain/check';
import { nativeWorkflowLifetimeRefCheck } from '../../../src/plugin/features/coforge/domain/native-workflow-lifetime';
import { nativeWorkflowProcessIdentityCheck } from '../../../src/plugin/features/coforge/domain/native-workflow-process';
import { OwnedWorktreeError } from '../../../src/plugin/infrastructure/coforge/native-process/owned-worktree-process';
import { outputClosingProvider } from './transport-provider';
import { ClaudeSessionResult } from '../../../src/plugin/infrastructure/coforge/claude-stream-result';
import { providerFailureInfo } from '../../../src/plugin/features/coforge/domain/provider-failure';

if (process.platform !== 'win32') throw new Error('The native Windows lifetime acceptance harness must run on Windows; no skipped substitute qualifies it.');
afterEach(cleanupNativeFixtures);
const nativeCoding = { runId: 'synthetic-run', attemptId: 'synthetic-attempt', projectId: 'synthetic-project' };
it('settles an actual detached descendant before returning a successful provider root result', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(); const phases: string[] = []; let authority: NativeWorkflowLifetimeRef | undefined;
  const result = await captureProcess(process.execPath, [f.script], { cwd: f.directory, input: 'Synthetic task', ownedTree: true, nativeCoding,
    onOwnedProcess: async (_identity, phase, lifetime) => { phases.push(phase); authority = lifetime; } });
  expect(JSON.parse(result)).toMatchObject({ structured_output: { summary: 'Synthetic completion' } });
  const before = await f.readMarker(); expect(before).toBeDefined(); await pause(300); expect(await f.readMarker()).toBe(before);
  expect(phases).toEqual(['launched', 'terminated']); expect(authority).toMatchObject({ kind: 'windows-job', ...nativeCoding });
});
it('preserves a live original job on wrong recovery ownership and stops only its verified original controller on correct recovery', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(true);
  const process = await startOwnedWorktreeProcess(globalThis.process.execPath, [f.script], { cwd: f.directory, owner: nativeCoding, input: 'Synthetic task', onStarted: async () => {} });
  try {
    await expect.poll(f.readMarker, { timeout: 10000 }).not.toBeUndefined();
    expect(await recoverOwnedWorktreeLifetime(process.identity, { ...process.lifetime, ownerToken: 'f'.repeat(64) })).toBeUndefined();
    const running = await f.readMarker(); await pause(150); expect(await f.readMarker()).not.toBe(running);
    const receipt = await recoverOwnedWorktreeLifetime(process.identity, process.lifetime);
    expect(receipt).toMatchObject({ proof: 'recovery', quiescent: true, activeProcesses: 0 });
    const stopped = await f.readMarker(); await pause(200); expect(await f.readMarker()).toBe(stopped);
    expect(await inspectOwnedWorktreeLifetime(process.identity, process.lifetime)).toEqual(receipt);
  } finally { await process.stop(); }
});
it('retains known empty-job proof for a failed native executable startup without pretending the command succeeded', async () => {
  const f = await nativeProcessFixture(); const invalid = join(f.directory, 'invalid.exe'); await writeFile(invalid, 'Synthetic invalid executable');
  const process = await startOwnedWorktreeProcess(invalid, [], { cwd: f.directory, owner: nativeCoding, onStarted: async () => {} });
  expect(await process.result).toMatchObject({ exitCode: null, reason: 'start-failed', quiescent: true });
  const receipt = await inspectOwnedWorktreeLifetime(process.identity, process.lifetime);
  expect(receipt).toMatchObject({ rootPid: 0, activeProcesses: 0 }); expect(receipt?.startupError).toBeGreaterThan(0);
});
it('does not miss cancellation during durable startup ownership capture or send task input afterward', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(true); const controller = new AbortController(); let release: (() => void) | undefined; let observed = false;
  const starting = startOwnedWorktreeProcess(process.execPath, [f.script], { cwd: f.directory, owner: nativeCoding, input: 'Synthetic task', signal: controller.signal,
    onStarted: async () => { observed = true; await new Promise<void>(resolve => { release = resolve; }); } });
  await expect.poll(() => observed, { timeout: 10000 }).toBe(true); controller.abort(); release!();
  const handle = await starting; const result = await handle.result;
  expect(result).toMatchObject({ reason: 'cancelled', quiescent: true, exitCode: null }); expect(await f.readMarker()).toBeUndefined();
});
it('settles a real active SDK job when the original Node owner exits without an explicit stop', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(true);
  const backend = join(f.directory, 'backend.cjs');
  await build({ entryPoints: ['src/plugin/infrastructure/coforge/native-process/owned-worktree-process.ts'], outfile: backend, platform: 'node', format: 'cjs', bundle: true, logLevel: 'silent' });
  const saved = join(f.directory, 'owner-state.json'), die = join(f.directory, 'owner-die'); const program = join(f.directory, 'owner.cjs');
  await writeFile(program, `const fs=require('node:fs'),backend=require(${JSON.stringify(backend)});backend.startOwnedWorktreeProcess(process.execPath,[${JSON.stringify(f.script)}],{cwd:${JSON.stringify(f.directory)},owner:${JSON.stringify(nativeCoding)},input:'Synthetic task',onStarted:async(identity,lifetime)=>fs.writeFileSync(${JSON.stringify(saved)},JSON.stringify({identity,lifetime}))}).then(()=>{setInterval(()=>{if(fs.existsSync(${JSON.stringify(die)}))process.exit(0)},20)});setTimeout(()=>process.exit(1),12000);`);
  const owner = spawn(process.execPath, [program], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
  const closed = new Promise<number | null>(resolve => owner.once('close', resolve));
  try {
    await expect.poll(f.readMarker, { timeout: 10000 }).not.toBeUndefined();
    const authority = shape({ identity: nativeWorkflowProcessIdentityCheck, lifetime: nativeWorkflowLifetimeRefCheck }, { strict: true })(JSON.parse(await readFile(saved, 'utf8')));
    await writeFile(die, 'exit'); expect(await closed).toBe(0);
    await expect.poll(async () => (await inspectOwnedWorktreeLifetime(authority.identity, authority.lifetime))?.quiescent, { timeout: 10000 }).toBe(true);
    expect(await inspectOwnedWorktreeLifetime(authority.identity, authority.lifetime)).toMatchObject({ reason: 'owner-lost', activeProcesses: 0 });
    const stopped = await f.readMarker(); await pause(250); expect(await f.readMarker()).toBe(stopped);
  } finally { await writeFile(die, 'exit'); await closed; }
});
it('retains private original authority as unknown when mandatory startup capture fails and its receipt ownership cannot be verified', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(true); let original: NativeWorkflowLifetimeRef | undefined;
  try {
    await startOwnedWorktreeProcess(process.execPath, [f.script], { cwd: f.directory, owner: nativeCoding, input: 'Must not execute', onStarted: async (_identity, lifetime) => {
      original = lifetime; await writeFile(join(lifetime.directory, 'owner.json'), JSON.stringify({ ...lifetime, ownerToken: 'f'.repeat(64) }));
      throw new Error('Synthetic mandatory journal failure');
    } });
    throw new Error('Unverified startup unexpectedly succeeded');
  } catch (error) {
    expect(error).toBeInstanceOf(OwnedWorktreeError);
    if (!(error instanceof OwnedWorktreeError)) throw error;
    expect(error.code).toBe('ownership_unknown'); expect(error.identity?.pid).toBeGreaterThan(0); expect(error.lifetime).toEqual(original);
    expect(JSON.stringify(error)).not.toContain(original?.ownerToken); expect(JSON.stringify(error)).not.toContain(original?.directory);
    expect(await f.readMarker()).toBeUndefined();
  } finally { if (original) await writeFile(join(original.directory, 'owner.json'), JSON.stringify(original)); }
});
it('cancels the original job and its detached descendants with a known cessation outcome', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(true); const controller = new AbortController(); const phases: string[] = [];
  const result = captureProcess(process.execPath, [f.script], { cwd: f.directory, input: 'Synthetic task', ownedTree: true, nativeCoding, signal: controller.signal,
    onOwnedProcess: async (_identity, phase) => { phases.push(phase); } });
  const rejected = expect(result).rejects.toBeInstanceOf(ProcessFailure);
  try { await expect.poll(f.readMarker, { timeout: 10000 }).not.toBeUndefined(); } finally { controller.abort(); }
  await rejected;
  const before = await f.readMarker(); await pause(300); expect(await f.readMarker()).toBe(before); expect(phases).toEqual(['launched', 'terminated']);
});
it('settles a managed SDK whose root stdout transport closes while the original process and writer stay alive', async () => {
  const f = await nativeProcessFixture();
  const executable = await outputClosingProvider(f.directory);
  const handle = await startOwnedWorktreeProcess(executable, [], { cwd: f.directory, owner: nativeCoding,
    input: 'Synthetic task', watchRootOutputClosure: true, onStarted: async () => {} });
  try {
    await expect.poll(f.readMarker, { timeout: 10000 }).not.toBeUndefined();
    const result = await handle.result;
    expect(result).toMatchObject({ reason: 'transport-closed', quiescent: true });
    expect(await inspectOwnedWorktreeLifetime(handle.identity, handle.lifetime)).toMatchObject({ reason: 'transport-closed', activeProcesses: 0 });
    const stopped = await f.readMarker(); await pause(250); expect(await f.readMarker()).toBe(stopped);
  } finally { await handle.stop(); }
});
it('does not stop a quiet managed SDK or treat prompt input EOF and an earlier result as root transport closure', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(true);
  const handle = await startOwnedWorktreeProcess(process.execPath, [f.script], { cwd: f.directory, owner: nativeCoding,
    input: 'Synthetic task', watchRootOutputClosure: true, onStarted: async () => {} });
  try {
    await expect.poll(f.readMarker, { timeout: 10000 }).not.toBeUndefined(); await pause(500);
    expect(handle.snapshot().state).toBe('running'); expect(await inspectOwnedWorktreeLifetime(handle.identity, handle.lifetime)).toBeUndefined();
  } finally { expect(await handle.stop()).toMatchObject({ quiescent: true, reason: 'cancelled' }); }
});
it.each([false, true])('treats root output closure as incomplete after verified cleanup, never as accepted output (candidate: %s)', async candidate => {
  const f = await nativeProcessFixture(); const executable = await outputClosingProvider(f.directory, candidate); const phases: string[] = [];
  let failure: unknown;
  try { await captureProcess(executable, [], { cwd: f.directory, input: 'Synthetic task', nativeCoding, managedSession: true,
    stdoutResult: new ClaudeSessionResult(undefined, true), onOwnedProcess: async (_identity, phase) => { phases.push(phase); } }); }
  catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(ProcessFailure); expect(providerFailureInfo(failure)?.code).toBe('incomplete_output');
  expect(phases).toEqual(['launched', 'terminated']);
  const stopped = await f.readMarker(); await pause(250); expect(await f.readMarker()).toBe(stopped);
});
it('does not impose SDK transport semantics on an ordinary command which deliberately closes its output', async () => {
  const f = await nativeProcessFixture(); const executable = await outputClosingProvider(f.directory);
  const handle = await startOwnedWorktreeProcess(executable, [], { cwd: f.directory, owner: nativeCoding, input: 'Synthetic task', onStarted: async () => {} });
  try { await expect.poll(f.readMarker, { timeout: 10000 }).not.toBeUndefined(); await pause(2500); expect(handle.snapshot().state).toBe('running'); }
  finally { expect(await handle.stop()).toMatchObject({ reason: 'cancelled', quiescent: true }); }
});
it('accepts a managed root only after its natural successful exit, validated envelope and stopped descendants', async () => {
  const f = await nativeProcessFixture(); await f.writeProvider(); const phases: string[] = [];
  const output = await captureProcess(process.execPath, [f.script], { cwd: f.directory, input: 'Synthetic task', nativeCoding, managedSession: true,
    stdoutResult: new ClaudeSessionResult(undefined, true), onOwnedProcess: async (_identity, phase) => { phases.push(phase); } });
  expect(JSON.parse(output)).toMatchObject({ is_error: false, structured_output: { summary: 'Synthetic completion' } });
  expect(phases).toEqual(['launched', 'terminated']);
});
