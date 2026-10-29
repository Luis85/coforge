import { mkdtemp, mkdir, lstat, readFile, copyFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build as viteBuild } from 'vite';
import { setTimeout as retrySleep } from 'node:timers/promises';
const names = ['main.js', 'styles.css', 'manifest.json'];
async function exists(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
/** Build and validate the whole candidate before replacing the last good directory. */
/** `target`/`sourcemap`/`logLevel` exist for contained dev candidates; the default release build is unchanged. */
export async function stagedBuild({ root = process.cwd(), build = viteBuild, target: directory = 'dist', sourcemap, logLevel, renameDirectory = rename, retryWait = retrySleep } = {}) {
  root = resolve(root);
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(directory) || directory.split('/').some(part => /^\.{1,2}$/.test(part))) throw new Error('UNSAFE_BUILD_TARGET');
  if (sourcemap !== undefined && sourcemap !== 'inline') throw new Error('UNSUPPORTED_BUILD_SOURCEMAP');
  const target = join(root, directory); const lock = join(root, '.shell-build-lock');
  const previous = await exists(target);
  if (previous && (!previous.isDirectory() || previous.isSymbolicLink())) throw new Error('UNSAFE_BUILD_TARGET');
  await mkdir(lock); // Refuse overlapping processes; never remove another process's lock.
  let stage; let backup; let keepStage = false;
  try {
    stage = await mkdtemp(join(root, '.shell-build-'));
    const output = join(stage, 'candidate');
    await build({ root, configFile: join(root, 'configs/bundling/vite.config.mjs'), ...(logLevel ? { logLevel } : {}),
      build: { outDir: output, emptyOutDir: true, ...(sourcemap ? { sourcemap } : {}) } });
    await copyFile(join(root, 'manifest.json'), join(output, 'manifest.json'));
    for (const name of names) {
      const stat = await lstat(join(output, name));
      if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) throw new Error(`INCOMPLETE_BUILD: ${name}`);
    }
    const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('INVALID_BUILD_IDENTITY');
    // The destination may have appeared while Vite compiled. Never promote over a stale snapshot.
    const current = await exists(target);
    if (current && (!current.isDirectory() || current.isSymbolicLink())) throw new Error('UNSAFE_BUILD_TARGET');
    try {
      if (current) { backup = join(stage, 'previous'); await retryRename(target, backup, renameDirectory, retryWait); }
      await retryRename(output, target, renameDirectory, retryWait);
    } catch (cause) {
      keepStage = true;
      let restored = false;
      if (backup && await exists(backup) && !await exists(target)) {
        try { await retryRename(backup, target, renameDirectory, retryWait); backup = undefined; restored = true; }
        catch { /* Preserve the previous directory and candidate for explicit recovery. */ }
      }
      const error = new Error(`BUILD_PROMOTION_FAILED (${cause.code ?? 'unknown'}): close tools watching or using the build directories and retry. ${restored ? 'The previous build was restored.' : 'Existing target and backup bytes were preserved.'} The complete candidate is retained at ${output}.`, { cause });
      error.code = 'BUILD_PROMOTION_FAILED'; error.recoveryPath = stage; throw error;
    }
    return { directory: target, version: manifest.version };
  } finally {
    // A failed rollback leaves its backup for manual recovery; never delete the last good bytes.
    try { if (stage && !keepStage) await rm(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    finally { await rm(lock, { recursive: true, maxRetries: 5, retryDelay: 100 }); }
  }
}
async function retryRename(from, to, operation, wait) {
  for (let attempt = 0; ; attempt++) {
    try { await operation(from, to); return; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
      await wait(50 * 2 ** attempt);
    }
  }
}
