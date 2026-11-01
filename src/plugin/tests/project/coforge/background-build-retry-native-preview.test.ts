import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
it('preserves explicit preview truncation when an ignored source file is included in the immutable copy', async () => {
  const f = await retrySourceFixture(folders);
  await writeFile(join(f.lease.cwd, 'game.ts'), 'Changed reviewed line\n'.repeat(12000));
  await writeFile(join(f.lease.cwd, '.gitignore'), 'ignored.txt\n'); await writeFile(join(f.lease.cwd, 'ignored.txt'), 'An additional reviewed ignored file');
  const inspection = await f.resources.inspect(f.source);
  expect(inspection.increment?.files.some(file => file.path === 'ignored.txt')).toBe(true);
  expect(inspection.increment?.diff.endsWith('[Preview truncated. Inspect the full worktree before accepting.]')).toBe(true);
  expect(await readFile(join(f.lease.cwd, 'ignored.txt'), 'utf8')).toBe('An additional reviewed ignored file');
}, 90000);
