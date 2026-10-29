import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { stagedBuild } from '../bundling/staged-build.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge locked build-')); await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: 'coforge', version: '0.1.0' }));
  for (const name of ['main.js', 'styles.css', 'manifest.json']) await writeFile(join(root, 'dist', name), `previous ${name}`);
  const build = async ({ build }) => { await mkdir(build.outDir); await writeFile(join(build.outDir, 'main.js'), 'complete new main'); await writeFile(join(build.outDir, 'styles.css'), 'complete new styles'); };
  return { root, build };
}
test('transient Windows candidate locks are retried without losing the complete previous build', async () => {
  const f = await fixture(); let attempts = 0;
  try {
    const result = await stagedBuild({ ...f, retryWait: async () => {}, renameDirectory: async (from, to) => {
      if (basename(from) === 'candidate' && ++attempts < 3) { const error = new Error('Temporarily locked'); error.code = 'EPERM'; throw error; }
      await rename(from, to);
    } });
    assert.equal(attempts, 3); assert.equal(result.directory, join(f.root, 'dist'));
    assert.equal(await readFile(join(f.root, 'dist/main.js'), 'utf8'), 'complete new main');
    assert.deepEqual((await readdir(f.root)).sort(), ['dist', 'manifest.json']);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('persistent promotion locks restore previous assets, retain the candidate and release only the owned lock', async () => {
  const f = await fixture(); let failure; let attempts = 0;
  try {
    try { await stagedBuild({ ...f, retryWait: async () => {}, renameDirectory: async (from, to) => {
      if (basename(from) === 'candidate') { attempts++; const error = new Error('Still locked'); error.code = 'EPERM'; throw error; }
      await rename(from, to);
    } }); } catch (error) { failure = error; }
    assert.equal(failure?.code, 'BUILD_PROMOTION_FAILED'); assert.equal(attempts, 6);
    assert.equal(await readFile(join(f.root, 'dist/main.js'), 'utf8'), 'previous main.js');
    assert.equal(await readFile(join(failure.recoveryPath, 'candidate/main.js'), 'utf8'), 'complete new main');
    assert.ok(!(await readdir(f.root)).includes('.shell-build-lock'));
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('the destination is rechecked after compilation rather than using a stale initial snapshot', async () => {
  const f = await fixture();
  try {
    await rm(join(f.root, 'dist'), { recursive: true });
    await stagedBuild({ root: f.root, build: async options => { await f.build(options); await mkdir(join(f.root, 'dist')); await writeFile(join(f.root, 'dist/old.txt'), 'created during compilation'); } });
    assert.equal(await readFile(join(f.root, 'dist/main.js'), 'utf8'), 'complete new main');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
