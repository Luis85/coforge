import { link, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';

const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true }); });
it('atomically preserves immutable input and rejects escaping or linked private files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-files-')); folders.push(directory);
  const files = new WorkerFiles(directory); await files.initialize();
  await files.create('input.json', { authorization: 'first' });
  await expect(files.create('input.json', { authorization: 'later' })).rejects.toThrow();
  expect(await files.read('input.json')).toEqual({ authorization: 'first' });
  await expect(files.write('../outside.json', {})).rejects.toThrow();
  await files.write('snapshot.json', { sequence: 1 }); await files.write('snapshot.json', { sequence: 2 });
  expect(JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8'))).toEqual({ sequence: 2 });
  const other = join(directory, 'other.json'); await writeFile(other, '{}');
  await link(other, join(directory, 'linked.json'));
  await expect(files.read('linked.json')).rejects.toThrow();
  await expect(files.write('linked.json', {})).rejects.toThrow();
});
