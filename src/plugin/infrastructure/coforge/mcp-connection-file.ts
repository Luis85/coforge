import { randomUUID } from 'node:crypto';
import { closeSync, fstatSync, ftruncateSync, openSync, readFileSync, renameSync, statSync, writeSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';

/** Small, non-yielding ownership sections fence plugin instances without keeping Windows files open. */
export class McpConnectionFile {
  private published: { dev: bigint; ino: bigint; id: string } | undefined;
  constructor(private readonly path: string) {}

  async publish(endpoint: string, token: string, current: () => boolean): Promise<void> {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    const id = randomUUID();
    try {
      await writeFile(temporary, JSON.stringify({ endpoint, token, publicationId: id }, null, 2), { flag: 'wx', mode: 0o600 });
      const identity = statSync(temporary, { bigint: true });
      if (!current()) return;
      // No await between the lifetime check, rename and owner capture.
      renameSync(temporary, this.path);
      this.published = { dev: identity.dev, ino: identity.ino, id };
    } finally { await unlink(temporary).catch(() => undefined); }
  }

  async clear(): Promise<void> {
    const owner = this.published; this.published = undefined;
    if (!owner) return;
    const handle = openSync(this.path, 'r+');
    try {
      const identity = fstatSync(handle, { bigint: true });
      if (identity.dev !== owner.dev || identity.ino !== owner.ino || !identity.isFile() || identity.size > 4096n) return;
      const existing: unknown = JSON.parse(readFileSync(handle, 'utf8'));
      if (!existing || typeof existing !== 'object' || !('publicationId' in existing) || existing.publicationId !== owner.id) return;
      // Verify and clear through the same descriptor without yielding or reopening the path.
      const content = Buffer.from(JSON.stringify({ endpoint: '', token: '' }, null, 2));
      if (writeSync(handle, content, 0, content.length, 0) !== content.length) throw new Error('MCP connection shutdown could not be published.');
      ftruncateSync(handle, content.length);
    } finally { closeSync(handle); }
  }
}
