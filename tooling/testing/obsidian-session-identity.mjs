import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix, win32 } from 'node:path';
import { assertNativeVault } from './native-isolation.mjs';

const paths = platform => platform === 'win32' ? win32 : posix;
const comparable = (value, platform) => platform === 'win32' ? value.toLowerCase() : value;

/** The launcher must describe the exact cached child and contained profile this session owns. */
export function assertNativeLaunchIdentity(proc, profile, root, port, platform = process.platform) {
  const path = paths(platform);
  if (!Number.isSafeInteger(proc?.pid) || proc.pid <= 0 || !path.isAbsolute(proc.spawnfile ?? '') || !path.isAbsolute(profile ?? '')) throw new Error('OBSIDIAN_PROCESS_OWNERSHIP_MISSING');
  const executable = path.resolve(proc.spawnfile);
  const relative = path.relative(path.resolve(root, '.native-cache'), executable);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('OBSIDIAN_PROCESS_EXECUTABLE_UNOWNED');
  const argument = proc.spawnargs?.find(value => typeof value === 'string' && value.startsWith('--user-data-dir='));
  if (!argument || comparable(path.resolve(argument.slice('--user-data-dir='.length)), platform) !== comparable(path.resolve(profile), platform)) throw new Error('OBSIDIAN_PROCESS_PROFILE_MISMATCH');
  if (port !== undefined && !proc.spawnargs.includes(`--remote-debugging-port=${port}`)) throw new Error('OBSIDIAN_PROCESS_PORT_MISMATCH');
  return { pid: proc.pid, executable, profile: path.resolve(profile), ...(port !== undefined ? { port } : {}) };
}

/** Read identity before plugin enable and before any teardown can remove installed evidence. */
export async function inspectNativeClient(client, { root, pluginDirectory = 'dist', profile, read = readFile, assertVault = assertNativeVault, platform = process.platform } = {}) {
  const path = paths(platform);
  const processIdentity = assertNativeLaunchIdentity(client.proc, profile, root, client.port, platform);
  const actualVault = await client.page.evaluate(() => window.app.vault.adapter.getBasePath());
  await assertVault(actualVault, client.vault);
  const sourceDirectory = path.resolve(root, pluginDirectory);
  const manifest = JSON.parse(await read(path.join(sourceDirectory, 'manifest.json'), 'utf8'));
  if (typeof manifest.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(manifest.id)) throw new Error('OBSIDIAN_ASSET_PLUGIN_ID_INVALID');
  const installedDirectory = path.join(client.vault, '.obsidian', 'plugins', manifest.id);
  const files = [];
  for (const name of ['main.js', 'styles.css', 'manifest.json']) {
    const [source, installed] = await Promise.all([read(path.join(sourceDirectory, name)), read(path.join(installedDirectory, name))]);
    const hash = value => createHash('sha256').update(value).digest('hex');
    files.push({ name, sourceSha256: hash(source), installedSha256: hash(installed), identical: source.equals(installed) });
  }
  return { sourceRoot: path.resolve(root), actualVault, requestedVault: client.vault, process: processIdentity, sourceDirectory, installedDirectory, files };
}
