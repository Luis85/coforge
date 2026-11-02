import { constants, createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { list, oneOf, shape, text } from '../../features/coforge/domain/check';

const pathCheck = (value: unknown) => {
  const path = text({ min: 1, max: 4096 })(value);
  if (path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || part === '.' || part === '..')) throw failure();
  return path;
};
const entryCheck = shape({ path: pathCheck, hash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
const manifestCheck = shape({ format: oneOf(['coforge-worker-transfer/v1']), from: text(), to: text(),
  files: list(entryCheck, { max: 100000 }), folders: list(pathCheck, { max: 100000 }) }, { strict: true });
type Inventory = Pick<ReturnType<typeof manifestCheck>, 'files' | 'folders'>;
const failure = () => new Error('Worker data migration needs recovery. Preserve both locations and the transfer receipt; no conflicting evidence was overwritten.');
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
async function hash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    if (!Buffer.isBuffer(chunk)) throw failure();
    digest.update(chunk);
  }
  return digest.digest('hex');
}
async function inventory(root: string): Promise<Inventory> {
  const result: Inventory = { files: [], folders: [] };
  async function visit(path: string, prefix: string): Promise<void> {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) throw failure();
    if (prefix.split('/').length > 100) throw failure();
    for (const name of (await readdir(path)).sort()) {
      const entry = prefix ? `${prefix}/${name}` : name;
      pathCheck(entry);
      const full = join(path, name), stat = await lstat(full);
      if (stat.isDirectory() && !stat.isSymbolicLink()) { result.folders.push(entry); await visit(full, entry); }
      else if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1) result.files.push({ path: entry, hash: await hash(full) });
      else throw failure();
      if (result.files.length + result.folders.length > 100000) throw failure();
    }
  }
  await visit(root, '');
  return result;
}
const same = (left: Inventory, right: Inventory) => JSON.stringify(left) === JSON.stringify(right);
/** Same-volume rename, or a verified cross-volume transfer with a retained, resumable receipt. */
export async function transferWorkerDirectory(source: string, target: string, move = rename): Promise<void> {
  const from = resolve(source), to = resolve(target);
  const nested = (a: string, b: string) => { const path = relative(a, b); return !path || !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep); };
  if (dirname(from) === from || dirname(to) === to || nested(from, to) || nested(to, from)) throw failure();
  const receipt = to + '.migration.json', temporary = to + '.migrating';
  await mkdir(dirname(to), { recursive: true, mode: 0o700 });
  if (!await exists(receipt)) {
    if (await exists(to)) throw failure();
    // Inventory also rejects linked files before a same-volume rename.
    const initial = await inventory(from);
    try { await move(from, to); return; }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EXDEV')) throw error; }
    await writeFile(receipt, JSON.stringify({ format: 'coforge-worker-transfer/v1', from, to, ...initial }), { flag: 'wx', mode: 0o600 });
  }
  const receiptInfo = await lstat(receipt);
  if (!receiptInfo.isFile() || receiptInfo.isSymbolicLink() || receiptInfo.nlink !== 1 || receiptInfo.size > 32 * 1024 * 1024) throw failure();
  const manifest = manifestCheck(JSON.parse(await readFile(receipt, 'utf8')));
  if (manifest.from !== from || manifest.to !== to) throw failure();
  const expected: Inventory = { files: manifest.files, folders: manifest.folders };
  const hashes = new Map(manifest.files.map(file => [file.path, file.hash]));
  const folders = new Set(manifest.folders);
  const subset = (value: Inventory) => value.files.every(file => hashes.get(file.path) === file.hash)
    && value.folders.every(folder => folders.has(folder));
  if (!await exists(to)) {
    if (!same(await inventory(from), expected)) throw failure();
    if (await exists(temporary)) {
      const partial = await inventory(temporary);
      if (!subset(partial)) throw failure();
    } else await mkdir(temporary, { mode: 0o700 });
    for (const folder of manifest.folders) if (!await exists(join(temporary, folder))) await mkdir(join(temporary, folder), { mode: 0o700 });
    for (const file of manifest.files) if (!await exists(join(temporary, file.path)))
      await copyFile(join(from, file.path), join(temporary, file.path), constants.COPYFILE_EXCL);
    if (!same(await inventory(temporary), expected) || !same(await inventory(from), expected)) throw failure();
    if (await exists(to)) throw failure();
    await move(temporary, to);
  }
  if (!same(await inventory(to), expected)) throw failure();
  // Delete only exact verified source entries. A crash during cleanup can resume from the receipt.
  if (await exists(from)) {
    const remaining = await inventory(from);
    if (!subset(remaining)) throw failure();
    for (const file of remaining.files) {
      if (await hash(join(from, file.path)) !== file.hash) throw failure();
      await unlink(join(from, file.path));
    }
    for (const folder of [...remaining.folders].reverse()) await rmdir(join(from, folder));
    await rmdir(from);
  }
  await unlink(receipt);
}
