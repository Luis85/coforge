import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareNativeCodexState } from '../../../infrastructure/coforge/codex-private-state';
import { createCodexPrivateRuntime, purgeCodexPrivateRuntime } from '../../../infrastructure/coforge/codex-private-runtime';
import { codexEnvironment } from '../../../infrastructure/coforge/codex-transport';

const roots: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge-codex-')); roots.push(root);
  const privateRuntime = await createCodexPrivateRuntime(root, { runId: 'run', attemptId: 'attempt', projectId: 'CFP-001' });
  const source = join(root, 'central-home'); await mkdir(source); vi.stubEnv('CODEX_HOME', source);
  return { root, source, privateRuntime };
}

it('prepares only invocation SQLite and logs without opening central credentials or copying customization', async () => {
  const f = await fixture();
  // A directory cannot be a file-backed credential; native keyring authentication must still be allowed.
  await mkdir(join(f.source, 'auth.json')); await writeFile(join(f.source, 'config.toml'), 'PERSONAL_SETTINGS');
  const state = await prepareNativeCodexState(f.root);
  expect(state).toEqual({ sqliteHome: join(f.root, 'codex-home', 'sqlite'), logDir: join(f.root, 'codex-home', 'logs') });
  expect(await readdir(join(f.root, 'codex-home'))).toEqual(['logs', 'sqlite']);
  expect(codexEnvironment().CODEX_HOME).toBe(f.source);
});

it('leaves SDK-refreshed canonical credentials and global rollouts outside private cleanup', async () => {
  const f = await fixture(); await writeFile(join(f.source, 'auth.json'), 'FAKE_ORIGINAL');
  await prepareNativeCodexState(f.root);
  // Simulates the SDK's own canonical refresh; CoForge never copies or writes these bytes.
  await writeFile(join(f.source, 'auth.json'), 'FAKE_REFRESHED_BY_SDK');
  await mkdir(join(f.source, 'sessions')); await writeFile(join(f.source, 'sessions', 'rollout.jsonl'), 'FAKE_SDK_ROLLOUT');
  await purgeCodexPrivateRuntime(f.privateRuntime);
  expect(await readFile(join(f.source, 'auth.json'), 'utf8')).toBe('FAKE_REFRESHED_BY_SDK');
  expect(await readFile(join(f.source, 'sessions', 'rollout.jsonl'), 'utf8')).toBe('FAKE_SDK_ROLLOUT');
  expect(await readdir(f.root)).toEqual(['central-home', 'native-runtime-owner.json']);
});

it.each(['OPENAI_API_KEY', 'CODEX_API_KEY'] as const)('preserves explicit %s mode and canonical credential-store selection', async key => {
  const f = await fixture(); vi.stubEnv(key, 'FAKE_API_KEY');
  await prepareNativeCodexState(f.root);
  expect(codexEnvironment()[key]).toBe('FAKE_API_KEY');
  expect(await readdir(join(f.root, 'codex-home'))).toEqual(['logs', 'sqlite']);
});
