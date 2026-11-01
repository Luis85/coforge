import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createCodexPrivateRuntime, purgeCodexPrivateRuntime } from '../../../infrastructure/coforge/codex-private-runtime';
import { nativeWorkflowProcessRecordCheck } from '../../../features/coforge/domain/native-workflow-process';
import { McpStepFiles } from '../../../infrastructure/coforge/mcp-step-files';
import { captureVerificationSource } from '../../../infrastructure/coforge/verification/source';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { nativePrivateRuntimeSegment, privateWorkflowSegment } from '../../../infrastructure/coforge/native-private-path';

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
async function fixture(home = true) {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-codex-')); folders.push(directory);
  const identity = { runId: 'run', attemptId: 'attempt', projectId: 'CFP-001' };
  const runtime = await createCodexPrivateRuntime(directory, identity);
  if (home) { await mkdir(join(directory, 'codex-home')); await writeFile(join(directory, 'codex-home', 'auth.json'), 'OPAQUE_FAKE_AUTH'); }
  return { directory, identity, runtime };
}

it('purges only the attributable private home, keeps outer evidence and supports interrupted bookkeeping retries', async () => {
  const f = await fixture(); await writeFile(join(f.directory, 'result-schema.json'), 'Keep outer evidence');
  expect(f.runtime.ownerToken).toMatch(/^[a-f0-9]{64}$/u);
  await purgeCodexPrivateRuntime(f.runtime);
  await expect(readFile(join(f.directory, 'codex-home', 'auth.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(join(f.directory, 'result-schema.json'), 'utf8')).toBe('Keep outer evidence');
  await expect(purgeCodexPrivateRuntime(f.runtime)).resolves.toBeUndefined();
});

it.each(['token', 'run', 'attempt', 'project', 'marker'] as const)('retains auth when the %s ownership evidence does not match', async reason => {
  const f = await fixture(); const runtime = { ...f.runtime };
  if (reason === 'token') runtime.ownerToken = 'b'.repeat(64);
  if (reason === 'run') runtime.runId = 'other-run';
  if (reason === 'attempt') runtime.attemptId = 'other-attempt';
  if (reason === 'project') runtime.projectId = 'CFP-999';
  if (reason === 'marker') await writeFile(join(f.directory, 'native-runtime-owner.json'), '{}');
  await expect(purgeCodexPrivateRuntime(runtime)).rejects.toThrow('ownership');
  expect(await readFile(join(f.directory, 'codex-home', 'auth.json'), 'utf8')).toBe('OPAQUE_FAKE_AUTH');
});

it('refuses arbitrary persisted paths and another valid native runtime directory', async () => {
  const f = await fixture(); const other = await fixture();
  const outside = await mkdtemp(join(tmpdir(), 'coforge-outside-')); folders.push(outside);
  await expect(purgeCodexPrivateRuntime({ ...f.runtime, directory: outside })).rejects.toThrow('ownership');
  await expect(purgeCodexPrivateRuntime({ ...f.runtime, directory: other.runtime.directory })).rejects.toThrow('ownership');
  expect(await readFile(join(other.directory, 'codex-home', 'auth.json'), 'utf8')).toBe('OPAQUE_FAKE_AUTH');
});

it('refuses a replaced home junction without touching its outside target', async () => {
  const f = await fixture(false); const outside = await mkdtemp(join(tmpdir(), 'coforge-outside-')); folders.push(outside);
  await writeFile(join(outside, 'keep.txt'), 'Outside data'); await symlink(outside, join(f.directory, 'codex-home'), 'junction');
  await expect(purgeCodexPrivateRuntime(f.runtime)).rejects.toThrow('ownership');
  expect(await readFile(join(outside, 'keep.txt'), 'utf8')).toBe('Outside data');
});

it('refuses linked ownership markers and inconsistent enclosing process identity', async () => {
  const f = await fixture(); await link(join(f.directory, 'native-runtime-owner.json'), join(f.directory, 'marker-copy'));
  await expect(purgeCodexPrivateRuntime(f.runtime)).rejects.toThrow('ownership');
  expect(() => nativeWorkflowProcessRecordCheck({ ...f.identity, runId: 'other', identity: { pid: 123, platform: 'win32', birth: 'fixture', image: 'a'.repeat(64) }, phase: 'unknown', observedAt: '2026-11-01T00:00:00Z', privateRuntime: f.runtime })).toThrow();
});

it('keeps native credential copies out of repository reads and verification snapshots even under a broader project root', async () => {
  const repository = await realpath(await mkdtemp(join(tmpdir(), 'coforge-game-'))); folders.push(repository);
  const home = join(repository, 'coforge-codex-Ab1234', 'codex-home'); await mkdir(home, { recursive: true });
  await writeFile(join(home, 'auth.json'), 'OPAQUE_FAKE_AUTH'); await writeFile(join(repository, 'game.ts'), 'game code');
  const input = { stage: 'plan' as const, idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration() };
  const lease = { cwd: repository, readOnly: true as const, validate: async () => {}, capture: async () => undefined, release: async () => {} };
  const files = new McpStepFiles();
  await expect(files.call('coforge_read_file', { input, lease }, { path: 'coforge-codex-Ab1234/codex-home/auth.json' })).rejects.toThrow();
  const before = await captureVerificationSource(lease);
  await writeFile(join(home, 'auth.json'), 'CHANGED_PRIVATE_AUTH');
  expect((await captureVerificationSource(lease)).sourceHash).toBe(before.sourceHash);
  const privateLease = { ...lease, cwd: join(repository, 'coforge-codex-Ab1234') };
  await expect(files.call('coforge_read_file', { input, lease: privateLease }, { path: 'codex-home/auth.json' })).rejects.toThrow();
  await expect(captureVerificationSource(privateLease)).rejects.toThrow();
});

it('reserves known private transport names without treating every CoForge source folder or contained fixture root as private', () => {
  for (const name of ['.nq', 'coforge-workflow-verification', 'coforge-codex-Ab1234', 'coforge-claude-reader-Ab1234', 'coforge-claude-native-Ab1234', 'coforge-council-Ab1234']) expect(privateWorkflowSegment(name)).toBe(true);
  expect(nativePrivateRuntimeSegment('.nq')).toBe(false);
  for (const name of ['coforge-features', 'coforge-codex-tools', 'coforge-game-Ab1234']) expect(privateWorkflowSegment(name)).toBe(false);
});
