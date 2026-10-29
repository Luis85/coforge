import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { installLauncher } from '../testing/obsidian-host.mjs';

test('Windows launcher provisioning keeps the native Node command and npm script paths as argv entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'obsidian installer with spaces '));
  const script = join(root, 'fake npm', 'npm-cli.cjs');
  try {
    await mkdir(join(root, 'fake npm'));
    await writeFile(script, "require('node:fs').writeFileSync('observed.json', JSON.stringify(process.argv.slice(2)));");
    installLauncher(root, () => {}, { platform: 'win32', env: { npm_execpath: script } });
    const args = JSON.parse(await readFile(join(root, 'observed.json'), 'utf8'));
    assert.deepEqual(args, ['install', '--prefix', '.native-runner', '--save-exact', '--no-fund', '--no-audit', 'obsidian-launcher@3.2.1']);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir())) && root.includes('obsidian installer with spaces '));
    await rm(root, { recursive: true, force: true });
  }
});
