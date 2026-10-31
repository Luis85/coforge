import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { compileDurableWorkerSource } from '../../../build/durable-worker-source.mjs';

const folders = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    if (!resolve(folder).startsWith(resolve('.nq') + sep)) throw new Error('Unsafe worker fixture cleanup');
    await rm(folder, { recursive: true, force: true });
  }
});
async function fixture(source) {
  const parent = resolve('.nq'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'worker-bundle-')); folders.push(root);
  await writeFile(join(root, 'entry.ts'), source);
  return root;
}

it('ships a self-contained Node worker as an inert string inside the existing plugin assets', async () => {
  const root = await fixture("import { createHash } from 'node:crypto';\nconst marker: string = '</script><!--worker-->';\nexport function main() { return createHash('sha256').update(marker).digest('hex'); }\n");
  const { code, files } = await compileDurableWorkerSource(root, 'entry.ts');
  const worker = join(root, 'worker.cjs'); await writeFile(worker, code);
  const { stdout } = await promisify(execFile)(process.execPath, ['-e', 'process.stdout.write(require(process.argv[1]).main())', worker], { cwd: root, windowsHide: true });
  expect(stdout).toMatch(/^[a-f0-9]{64}$/u);
  expect(code).not.toContain('require("obsidian")');
  expect(files.map(file => file.replaceAll('\\', '/'))).toContain(join(root, 'entry.ts').replaceAll('\\', '/'));
  const module = await import(`data:text/javascript;base64,${Buffer.from(`export default ${JSON.stringify(code)}`).toString('base64')}`);
  expect(module.default).toBe(code);
});

it('refuses a worker graph that needs the Obsidian host module', async () => {
  const root = await fixture("import { Notice } from 'obsidian'; export function main() { return new Notice('not a worker'); }");
  await expect(compileDurableWorkerSource(root, 'entry.ts')).rejects.toThrow(/obsidian|host module/iu);
});
