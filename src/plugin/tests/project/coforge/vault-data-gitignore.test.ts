import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { protectPrivateData } from '../../../infrastructure/coforge/private-data-guard';
import { captureProcess } from '../../../infrastructure/coforge/process';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve('.nq') + sep)) throw new Error('Invalid fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
it.each(['.host\\plugins\\coforge\\', '.host [private]\\plugins\\CoForge [beta]'])('ignores exact settings and workers with Windows manifest path %s', async directory => {
  const app = new App(); const kit = createTestApp({ app });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', dir: directory, name: 'CoForge', version: '1', minAppVersion: '1', author: '', description: '' });
  await protectPrivateData(plugin);
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'vault-ignore-'))); roots.push(root);
  await writeFile(join(root, '.gitignore'), kit.read('.gitignore'));
  const emptyExcludes = join(root, 'empty-git-excludes');
  await writeFile(emptyExcludes, '');
  const installed = directory.replaceAll('\\', '/').replace(/\/+$/u, '');
  const settings = `${installed}/data.json`, code = `${installed}/main.js`;
  const worker = '.coforge-data/runtime/workers/machine/credentials.json';
  const unrelated = '.host p/plugins/CoForge b/data.json';
  for (const path of [settings, code, worker, unrelated]) {
    await mkdir(join(root, path.slice(0, path.lastIndexOf('/'))), { recursive: true });
    await writeFile(join(root, path), 'synthetic');
  }
  await captureProcess('git', ['init', '-q'], { cwd: root });
  const ignored = await captureProcess('git', ['-c', 'core.quotePath=false', '-c', `core.excludesFile=${emptyExcludes}`, 'check-ignore', '--no-index', settings, worker, code, unrelated], { cwd: root });
  expect(ignored.trim().split(/\r?\n/u)).toEqual([settings, worker]);
});
