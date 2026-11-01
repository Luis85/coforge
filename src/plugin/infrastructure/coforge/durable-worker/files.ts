import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const invalid = () => new Error('The private Build worker files changed or are unavailable. Inspect the original worker before retrying.');
const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const replacementDelays = [5, 15, 40, 100];
const replacementLocked = (error: unknown) => error instanceof Error && 'code' in error && typeof error.code === 'string' && ['EPERM', 'EACCES', 'EBUSY'].includes(error.code);
export class WorkerFiles {
  constructor(private root: string) {}
  get directory(): string { return this.root; }
  path(name: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/u.test(name) || name.includes('..')) throw invalid();
    return join(this.directory, name);
  }
  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.attach();
  }
  async attach(): Promise<void> {
    const info = await lstat(this.directory); if (!info.isDirectory() || info.isSymbolicLink()) throw invalid();
    this.root = await realpath(this.directory); await this.verify();
  }
  private async verify(): Promise<void> {
    const info = await lstat(this.directory); const actual = await realpath(this.directory);
    const same = process.platform === 'win32' ? actual.toLowerCase() === resolve(this.directory).toLowerCase() : actual === resolve(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink() || !same) throw invalid();
  }
  async verifyIdentity(): Promise<void> { await this.verify(); }
  async child(name: string): Promise<WorkerFiles> { await this.verify(); const files = new WorkerFiles(this.path(name)); await files.initialize(); return files; }
  async read(name: string, maxBytes = 16 * 1024 * 1024): Promise<unknown | undefined> {
    await this.verify(); const path = this.path(name);
    let before;
    try { before = await lstat(path); } catch (error) { if (missing(error)) return undefined; throw invalid(); }
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maxBytes) throw invalid();
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat(); if (info.dev !== before.dev || info.ino !== before.ino || info.size > maxBytes) throw invalid();
      const raw = await handle.readFile('utf8'); const current = await lstat(path);
      if (Buffer.byteLength(raw) > maxBytes || current.dev !== info.dev || current.ino !== info.ino || current.isSymbolicLink()) throw invalid();
      return JSON.parse(raw);
    } finally { await handle.close(); }
  }
  async create(name: string, value: unknown): Promise<void> {
    await this.verify(); const file = await open(this.path(name), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
  }
  async createSource(name: string, source: string): Promise<void> {
    await this.verify(); if (Buffer.byteLength(source) > 16 * 1024 * 1024) throw invalid();
    const file = await open(this.path(name), 'wx', 0o600);
    try { await file.writeFile(source); await file.sync(); } finally { await file.close(); }
  }
  async write(name: string, value: unknown): Promise<void> {
    await this.verify(); const path = this.path(name);
    const before = await lstat(path).catch(error => { if (missing(error)) return undefined; throw invalid(); });
    if (before && (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)) throw invalid();
    const temporary = this.path(`pending-${randomUUID()}.json`); const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(value)); await file.sync(); const staged = await file.stat(); await file.close();
      for (let attempt = 0; ; attempt++) {
        await this.verify();
        const current = await lstat(path).catch(error => { if (missing(error)) return undefined; throw invalid(); });
        if ((before && !current) || (current && (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.dev !== before?.dev || current.ino !== before?.ino))) throw invalid();
        const pending = await lstat(temporary);
        if (!pending.isFile() || pending.isSymbolicLink() || pending.nlink !== 1 || pending.dev !== staged.dev || pending.ino !== staged.ino || pending.size !== staged.size) throw invalid();
        try { await rename(temporary, path); break; }
        catch (error) {
          const wait = replacementDelays[attempt]; if (wait === undefined || !replacementLocked(error)) throw error;
          await delay(wait);
        }
      }
    } finally { await file.close().catch(() => undefined); await unlink(temporary).catch(() => undefined); }
  }
  async source(name: string): Promise<string> { await this.verify(); const path = this.path(name); const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw invalid(); return readFile(path, 'utf8'); }
}
