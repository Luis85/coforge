import { link, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { prepareNativeCodexHome } from '../../../infrastructure/coforge/codex-private-auth';

const roots: string[] = [];
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge-codex-auth-')); roots.push(root);
  const source = join(root, 'source'); const target = join(root, 'runtime'); await mkdir(source); await mkdir(target);
  return { source, target };
}

it('copies only bounded regular auth bytes into a private home without parsing credentials or copying customization', async () => {
  const f = await fixture(); const bytes = Buffer.from('fake opaque auth bytes\n\u0000\xff', 'utf8');
  await writeFile(join(f.source, 'auth.json'), bytes); await writeFile(join(f.source, 'config.toml'), 'NEVER_COPY');
  await mkdir(join(f.source, 'agents')); await writeFile(join(f.source, 'agents', 'override.toml'), 'NEVER_COPY');
  await writeFile(join(f.source, 'models_cache.json'), 'NEVER_COPY');
  const env = await prepareNativeCodexHome(f.target, { CODEX_HOME: f.source });
  expect(env.CODEX_HOME).toBe(join(f.target, 'codex-home'));
  expect(await readFile(join(env.CODEX_HOME!, 'auth.json'))).toEqual(bytes);
  expect(await readdir(env.CODEX_HOME!)).toEqual(['auth.json']);
  expect(await readFile(join(f.source, 'auth.json'))).toEqual(bytes);
});

it('uses an explicit native API-key environment without reading or copying the user home', async () => {
  const f = await fixture();
  const env = await prepareNativeCodexHome(f.target, { CODEX_HOME: '/not-readable', OPENAI_API_KEY: 'FAKE_API_KEY' });
  expect(env.CODEX_HOME).toBe(join(f.target, 'codex-home'));
  expect(await readdir(env.CODEX_HOME!)).toEqual([]);
  expect(JSON.stringify(env)).not.toContain('FAKE_API_KEY');
});

it.each(['missing', 'directory', 'oversize'] as const)('refuses %s file-based authentication without falling back to a global home', async problem => {
  const f = await fixture();
  if (problem === 'directory') await mkdir(join(f.source, 'auth.json'));
  if (problem === 'oversize') await writeFile(join(f.source, 'auth.json'), Buffer.alloc(1024 * 1024 + 1));
  await expect(prepareNativeCodexHome(f.target, { CODEX_HOME: f.source })).rejects.toThrow('isolated');
  expect(await readdir(join(f.target, 'codex-home'))).toEqual([]);
});

it('refuses linked auth credentials', async () => {
  const f = await fixture(); await writeFile(join(f.source, 'actual'), 'fake auth'); await link(join(f.source, 'actual'), join(f.source, 'auth.json'));
  await expect(prepareNativeCodexHome(f.target, { CODEX_HOME: f.source })).rejects.toThrow('isolated');
});
