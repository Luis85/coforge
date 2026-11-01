import { mkdtemp, mkdir, writeFile, readFile, rm, link, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { McpStepFiles } from '../../../infrastructure/coforge/mcp-step-files';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture(access: 'none' | 'readproject' | 'editworktree') {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'coforge-mcp-files-'))); folders.push(cwd);
  await writeFile(join(cwd, 'game.ts'), 'const lantern = false;');
  const task = { input: { stage: 'implement' as const, idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', definitionRevision: 'def', proposalRevision: 'rev', attemptId: 'attempt', inputArtifacts: [],
      step: { id: 'step', name: 'Step', kind: 'ai' as const, instructions: 'Work', provider: 'claude' as const, model: 'model', automatic: false, output: 'markdown' as const, access } } },
    lease: { cwd, capture: async () => undefined, release: async () => {} } };
  return { cwd, task, files: new McpStepFiles() };
}
it('reads/lists/searches repository files and writes only with an exact content precondition', async () => {
  const f = await fixture('editworktree');
  expect(await f.files.call('coforge_list_files', f.task, {})).toEqual({ files: ['game.ts'], truncated: false });
  expect(await f.files.call('coforge_read_file', f.task, { path: 'game.ts' })).toEqual({ path: 'game.ts', content: 'const lantern = false;' });
  expect(await f.files.call('coforge_search_files', f.task, { query: 'lantern' })).toMatchObject({ matches: [{ path: 'game.ts', line: 1 }] });
  await expect(f.files.call('coforge_write_file', f.task, { path: 'game.ts', content: 'lost', expectedContent: null })).rejects.toThrow();
  await f.files.call('coforge_write_file', f.task, { path: 'game.ts', content: 'const lantern = true;', expectedContent: 'const lantern = false;' });
  expect(await readFile(join(f.cwd, 'game.ts'), 'utf8')).toBe('const lantern = true;');
  await expect(f.files.call('coforge_delete_file', f.task, { path: 'game.ts', expectedContent: 'stale' })).rejects.toThrow();
  expect(await f.files.call('coforge_delete_file', f.task, { path: 'game.ts', expectedContent: 'const lantern = true;' })).toEqual({ path: 'game.ts', deleted: true });
});
it('enforces stage permissions, denies traversal, metadata, secrets, symlinks and hardlinks', async () => {
  const f = await fixture('readproject');
  for (const path of ['.git /config', '.env.', 'NUL', 'folder/LPT1.txt'])
    await expect(f.files.call('coforge_read_file', f.task, { path })).rejects.toThrow('not permitted');
  for (const path of ['../outside', '/absolute', 'C:/absolute', '.git/config', '.env', 'secret.pem', '.mcp.json', '.claude/settings.json', 'x/../game.ts'])
    await expect(f.files.call('coforge_read_file', f.task, { path })).rejects.toThrow();
  await expect(f.files.call('coforge_write_file', f.task, { path: 'game.ts', content: 'bad', expectedContent: 'const lantern = false;' })).rejects.toThrow();
  await link(join(f.cwd, 'game.ts'), join(f.cwd, 'linked.ts'));
  await expect(f.files.call('coforge_read_file', f.task, { path: 'linked.ts' })).rejects.toThrow();
  await mkdir(join(f.cwd, 'private'));
  await symlink(join(f.cwd, 'private'), join(f.cwd, 'alias'), 'junction');
  await expect(f.files.call('coforge_list_files', f.task, { path: 'alias' })).rejects.toThrow();
  await expect(f.files.call('coforge_list_files', { ...f.task, lease: { ...f.task.lease, cwd: join(f.cwd, 'alias') } }, {})).rejects.toThrow();
  const noFiles = await fixture('none');
  await expect(noFiles.files.call('coforge_list_files', noFiles.task, {})).rejects.toThrow();
});
it('narrows discovery by relative path and filename before the returned-file limit', async () => {
  const f = await fixture('readproject');
  await mkdir(join(f.cwd, 'src/styles'), { recursive: true });
  await writeFile(join(f.cwd, 'src/styles/coworkers.css'), '.pool { display: grid; }');
  await mkdir(join(f.cwd, 'archive'));
  await Promise.all(Array.from({ length: 1001 }, (_, index) => writeFile(join(f.cwd, 'archive', `${index}.txt`), 'historical')));
  expect(await f.files.call('coforge_list_files', f.task, {})).toMatchObject({ truncated: true, narrowingHint: expect.stringContaining('path') });
  expect(await f.files.call('coforge_list_files', f.task, { path: '', query: 'coworkers' }))
    .toEqual({ files: ['src/styles/coworkers.css'], truncated: false });
  expect(await f.files.call('coforge_search_files', f.task, { path: 'src/styles', query: 'display' }))
    .toEqual({ matches: [{ path: 'src/styles/coworkers.css', line: 1, text: '.pool { display: grid; }' }], truncated: false });
});
it('does not expose excluded files or escape the lease when narrowing discovery', async () => {
  const f = await fixture('readproject');
  await mkdir(join(f.cwd, 'managed'));
  await writeFile(join(f.cwd, 'managed/private.md'), 'PRIVATE');
  await mkdir(join(f.cwd, '.coforge-run-output'));
  await writeFile(join(f.cwd, '.coforge-run-output/private.md'), 'PRIVATE');
  const task = { ...f.task, lease: { ...f.task.lease, readOnly: true as const, protectedProjectPaths: ['managed'], validate: async () => {} } };
  expect(await f.files.call('coforge_list_files', task, { query: 'private' })).toEqual({ files: [], truncated: false });
  for (const path of ['../outside', '.git', 'managed', '.coforge-run-output']) {
    await expect(f.files.call('coforge_search_files', task, { path, query: 'PRIVATE' })).rejects.toThrow();
    await expect(f.files.call('coforge_list_files', task, { path, query: 'private' })).rejects.toThrow();
  }
  await expect(f.files.call('coforge_read_file', task, { path: '.coforge-run-output/private.md' })).rejects.toThrow('not permitted');
});
it('reports content-byte and match limits as incomplete and lets the agent narrow the path', async () => {
  const f = await fixture('readproject');
  await mkdir(join(f.cwd, 'archive'));
  await mkdir(join(f.cwd, 'src'));
  await Promise.all(Array.from({ length: 12 }, (_, index) => writeFile(join(f.cwd, 'archive', `${index}.txt`), 'x'.repeat(190000))));
  await writeFile(join(f.cwd, 'src/view.css'), '.pool {}');
  expect(await f.files.call('coforge_search_files', f.task, { query: '.pool' }))
    .toMatchObject({ matches: [], truncated: true, narrowingHint: expect.stringContaining('path') });
  expect(await f.files.call('coforge_search_files', f.task, { path: 'src', query: '.pool' }))
    .toMatchObject({ matches: [{ path: 'src/view.css' }], truncated: false });
  await writeFile(join(f.cwd, 'src/matches.txt'), Array.from({ length: 101 }, () => 'match').join('\n'));
  const result = await f.files.call('coforge_search_files', f.task, { path: 'src', query: 'match' });
  expect(result).toMatchObject({ matches: expect.any(Array), truncated: true, narrowingHint: expect.stringContaining('path') });
  expect(result).toHaveProperty('matches.length', 100);
});
