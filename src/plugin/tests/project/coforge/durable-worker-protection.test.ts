import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { captureProjectProtection } from '../../../infrastructure/coforge/durable-worker/protection';
import { captureProcess } from '../../../infrastructure/coforge/process';
import { McpStepFiles } from '../../../infrastructure/coforge/mcp-step-files';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { durableRequest } from './durable-worker-fixture';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true }); });
async function parent() { const value = await mkdtemp(join(tmpdir(), 'coforge-worker-protection-')); folders.push(value); return realpath(value); }
it('captures default/custom managed folders against the actual Git root, including subdirectory and vault nesting', async () => {
  const root = await parent(); const vault = join(root, 'vault'); const sub = join(vault, 'Game'); await mkdir(sub, { recursive: true });
  await captureProcess('git', ['init', '-q'], { cwd: vault });
  const same = await captureProjectProtection(vault, sub, ['CoForge', 'Custom/Ideas', 'Published']);
  expect(same.projectRoot).toBe(await realpath(vault)); expect(same.protectedProjectPaths).toEqual(['CoForge', 'Custom/Ideas', 'Published']);
  const ancestor = join(root, 'ancestor'); const nestedVault = join(ancestor, 'Notes'); await mkdir(nestedVault, { recursive: true });
  await captureProcess('git', ['init', '-q'], { cwd: ancestor });
  expect((await captureProjectProtection(nestedVault, ancestor, ['CoForge', 'Private/Ideas'])).protectedProjectPaths).toEqual(['Notes/CoForge', 'Notes/Private/Ideas']);
  const separate = join(root, 'separate'); await mkdir(separate); await captureProcess('git', ['init', '-q'], { cwd: separate });
  expect((await captureProjectProtection(vault, separate, ['CoForge'])).protectedProjectPaths).toEqual([]);
  const inside = join(vault, 'CoForge', 'Game'); await mkdir(inside, { recursive: true }); await captureProcess('git', ['init', '-q'], { cwd: inside });
  await expect(captureProjectProtection(vault, inside, ['CoForge'])).rejects.toThrow('boundary');
});
it('excludes protected copies from every broker operation while retaining normal repository edits', async () => {
  const root = await parent(); await mkdir(join(root, 'CoForge', 'Ideas'), { recursive: true }); await mkdir(join(root, 'Custom', 'People'), { recursive: true }); await mkdir(join(root, 'src'));
  await writeFile(join(root, 'CoForge', 'Ideas', 'secret.md'), 'PRIVATE request'); await writeFile(join(root, 'Custom', 'People', 'player.md'), 'PRIVATE player');
  await writeFile(join(root, 'src', 'game.ts'), 'before');
  const request = durableRequest(); const input = { ...request.input, integration: { ...defaultIntegration(), ...request.input.integration } };
  const task = { input, lease: { cwd: root, validate: async () => {}, capture: async () => undefined, release: async () => {} } };
  const files = new McpStepFiles(['CoForge', 'Custom/People']);
  expect(await files.call('coforge_list_files', task, { path: '' })).toMatchObject({ files: ['src/game.ts'] });
  expect(await files.call('coforge_search_files', task, { query: 'PRIVATE' })).toMatchObject({ matches: [] });
  await expect(files.call('coforge_list_files', task, { path: 'CoForge' })).rejects.toThrow();
  await expect(files.call('coforge_read_file', task, { path: 'CoForge/Ideas/secret.md' })).rejects.toThrow();
  await expect(files.call('coforge_write_file', task, { path: 'Custom/People/player.md', content: 'leaked', expectedContent: 'PRIVATE player' })).rejects.toThrow();
  await expect(files.call('coforge_delete_file', task, { path: 'CoForge/Ideas/secret.md', expectedContent: 'PRIVATE request' })).rejects.toThrow();
  await files.call('coforge_write_file', task, { path: 'src/game.ts', content: 'after', expectedContent: 'before' });
  expect(await readFile(join(root, 'src', 'game.ts'), 'utf8')).toBe('after');
  expect(await readFile(join(root, 'CoForge', 'Ideas', 'secret.md'), 'utf8')).toBe('PRIVATE request');
});
it('unions lease and broker protections, enforces readonly scope, and revalidates before returning observed content', async () => {
  const root = await parent(); await mkdir(join(root, 'Managed')); await mkdir(join(root, 'Private'));
  await writeFile(join(root, 'Managed', 'request.md'), 'First boundary'); await writeFile(join(root, 'Private', 'profile.md'), 'Lease boundary'); await writeFile(join(root, 'game.ts'), 'original');
  const request = durableRequest(); const validate = vi.fn(async () => {});
  const task = { input: { ...request.input, integration: { ...defaultIntegration(), ...request.input.integration } },
    lease: { cwd: root, readOnly: true as const, protectedProjectPaths: ['Private'], validate, capture: async () => undefined, release: async () => {} } };
  const files = new McpStepFiles(['Managed']);
  expect(await files.call('coforge_list_files', task, { path: '' })).toMatchObject({ files: ['game.ts'] });
  await expect(files.call('coforge_read_file', task, { path: 'Private/profile.md' })).rejects.toThrow();
  await expect(files.call('coforge_read_file', task, { path: 'Managed/request.md' })).rejects.toThrow();
  await expect(files.call('coforge_write_file', task, { path: 'game.ts', content: 'edited', expectedContent: 'original' })).rejects.toThrow();
  await expect(files.call('coforge_delete_file', task, { path: 'game.ts', expectedContent: 'original' })).rejects.toThrow();
  expect(await readFile(join(root, 'game.ts'), 'utf8')).toBe('original');
  validate.mockClear(); validate.mockImplementationOnce(async () => {}).mockImplementationOnce(async () => { throw new Error('Lease changed during read'); });
  await expect(files.call('coforge_read_file', task, { path: 'game.ts' })).rejects.toThrow('Lease changed during read');
  expect(validate).toHaveBeenCalledTimes(2);
});
