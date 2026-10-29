import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { assertNativeLaunchIdentity, inspectNativeClient } from '../../../../../tooling/testing/obsidian-session-identity.mjs';

function fixture() {
  const root = resolve('owned-coforge-fixture');
  const vault = join(root, '.nq', 'abcdef', 'vault');
  const profile = join(root, '.nq', 'abcdef', 'obsidian-launcher-config-fixture');
  const executable = join(root, '.native-cache', 'obsidian-installer', 'Obsidian.exe');
  const proc = { pid: 321, spawnfile: executable, spawnargs: [executable, `--user-data-dir=${profile}`, '--remote-debugging-port=12345'] };
  const client = { vault, port: 12345, proc, page: { evaluate: vi.fn(async () => vault) } };
  const files = new Map();
  for (const [name, content] of [['main.js', 'owned code'], ['styles.css', 'owned styles'], ['manifest.json', '{"id":"coforge","version":"0.1.0"}']]) {
    files.set(join(root, 'dist', name), Buffer.from(content));
    files.set(join(vault, '.obsidian', 'plugins', 'coforge', name), Buffer.from(content));
  }
  const read = vi.fn(async (path, encoding) => { const content = files.get(path); if (!content) throw new Error('missing fixture asset'); return encoding === 'utf8' ? content.toString('utf8') : content; });
  const assertVault = vi.fn(async (actual, requested) => { if (actual !== requested) throw new Error('UNSAFE_NATIVE_VAULT'); });
  return { root, profile, client, files, read, options: { root, profile, read, assertVault } };
}

it('records owned process/profile and exact source/installed asset hashes before cleanup', async () => {
  const f = fixture(); const identity = await inspectNativeClient(f.client, f.options);
  expect(identity).toMatchObject({ sourceRoot: f.root, actualVault: f.client.vault, requestedVault: f.client.vault, process: { pid: 321, profile: f.profile, port: 12345 } });
  expect(identity.files.map(file => file.name)).toEqual(['main.js', 'styles.css', 'manifest.json']);
  expect(identity.files.every(file => file.identical && file.sourceSha256 === file.installedSha256)).toBe(true);
  expect(identity.files[0].sourceSha256).toBe(createHash('sha256').update('owned code').digest('hex'));
});

it('detects stale installed bytes without pretending version labels prove asset identity', async () => {
  const f = fixture(); f.files.set(join(f.client.vault, '.obsidian', 'plugins', 'coforge', 'main.js'), Buffer.from('old code'));
  const identity = await inspectNativeClient(f.client, f.options);
  expect(identity.files[0]).toMatchObject({ name: 'main.js', identical: false });
  expect(identity.files[0].sourceSha256).not.toBe(identity.files[0].installedSha256);
});

it('rejects a foreign CDP vault before reading any plugin assets', async () => {
  const f = fixture(); f.client.page.evaluate.mockResolvedValue(join(f.root, '.nq', 'other-session', 'vault'));
  await expect(inspectNativeClient(f.client, f.options)).rejects.toThrow('UNSAFE_NATIVE_VAULT');
  expect(f.read).not.toHaveBeenCalled();
});

it('rejects mismatched launched profiles and executables before trusting a debugger connection', () => {
  const f = fixture();
  expect(() => assertNativeLaunchIdentity(f.client.proc, join(f.profile, 'other'), f.root, f.client.port)).toThrow('OBSIDIAN_PROCESS_PROFILE_MISMATCH');
  expect(() => assertNativeLaunchIdentity({ ...f.client.proc, spawnfile: join(f.root, 'other-host', 'Obsidian.exe') }, f.profile, f.root, f.client.port)).toThrow('OBSIDIAN_PROCESS_EXECUTABLE_UNOWNED');
  expect(f.client.page.evaluate).not.toHaveBeenCalled();
});
