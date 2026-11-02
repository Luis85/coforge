import { afterEach, expect, it, vi } from 'vitest';
import { link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { McpStepFiles } from '../../../infrastructure/coforge/mcp-step-files';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';

vi.mock('node:fs/promises', async original => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, readdir: vi.fn(actual.readdir), readFile: vi.fn(actual.readFile) };
});
const roots: string[] = [];
afterEach(async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(readdir).mockReset().mockImplementation(actual.readdir); vi.mocked(readFile).mockReset().mockImplementation(actual.readFile);
  for (const root of roots.splice(0)) {
    if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe MCP search fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir('.nq', { recursive: true }); const root = await realpath(await mkdtemp(join(resolve('.nq'), 'mcp-file-search-'))); roots.push(root);
  await mkdir(join(root, 'src')); await writeFile(join(root, 'src/studio-example.ts'), 'export const name = "example";\nexport const template = "starter";\n');
  await writeFile(join(root, 'another.ts'), 'const template = "outside the selected scope";');
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      step: { id: 'refine', name: 'Refine', kind: 'ai', provider: 'claude', model: 'sonnet', access: 'readproject', output: 'markdown', instructions: 'Research', automatic: false } } };
  const validate = vi.fn(async () => {}), capture = vi.fn(async () => undefined);
  const task = { input, lease: { cwd: root, readOnly: true as const, protectedProjectPaths: ['managed'], validate, capture, release: async () => {} } };
  const files = new McpStepFiles();
  return { root, validate, capture, call: (path: string, query = 'template') => files.call('coforge_search_files', task, { path, query }) };
}

it('searches the exact UTF-8 file requested during CF-133 refinement and validates its readonly lease before and after', async () => {
  const f = await fixture();
  expect(await f.call('src/studio-example.ts')).toEqual({ matches: [{ path: 'src/studio-example.ts', line: 2, text: 'export const template = "starter";' }], truncated: false });
  expect(f.validate).toHaveBeenCalledTimes(2); expect(f.capture).not.toHaveBeenCalled();
  expect(await readFile(join(f.root, 'src/studio-example.ts'), 'utf8')).toContain('template = "starter"');
});

it('keeps directory scopes and their existing matching behavior', async () => {
  const f = await fixture();
  expect(await f.call('src')).toMatchObject({ matches: [{ path: 'src/studio-example.ts', line: 2 }], truncated: false });
  expect(await f.call('src', 'Template')).toEqual({ matches: [], truncated: false });
});

it.each(['missing.ts', 'src/studio-example.ts/not-a-directory'])('returns an actionable typed error for an unavailable scope: %s', async path => {
  const f = await fixture();
  await expect(f.call(path)).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS', nextTool: 'coforge_list_files' });
  expect(await f.call('src')).toMatchObject({ matches: [{ path: 'src/studio-example.ts' }] });
});

it.each(['oversized', 'binary', 'invalid-utf8'] as const)('rejects an explicit %s file without presenting a false empty search', async kind => {
  const f = await fixture(); const path = `src/${kind}.txt`;
  const content = kind === 'oversized' ? Buffer.alloc(200001, 120) : kind === 'binary' ? Buffer.from('template\0secret') : Buffer.from([255, 254, 116]);
  await writeFile(join(f.root, path), content);
  await expect(f.call(path)).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
});

it('keeps protected paths, symbolic directory aliases and hardlinked files outside exact-file search authority', async () => {
  const f = await fixture();
  await mkdir(join(f.root, 'managed')); await writeFile(join(f.root, 'managed/private.ts'), 'template');
  await writeFile(join(f.root, '.env'), 'template');
  await symlink(join(f.root, 'src'), join(f.root, 'alias'), 'junction');
  await link(join(f.root, 'src/studio-example.ts'), join(f.root, 'linked.ts'));
  for (const path of ['managed/private.ts', '.env', 'alias/studio-example.ts', 'linked.ts', '../outside.ts'])
    await expect(f.call(path)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  expect((await lstat(join(f.root, 'linked.ts'))).nlink).toBe(2);
});

it('keeps permission errors typed and content-free and accepts the following readonly request', async () => {
  const f = await fixture();
  vi.mocked(readdir).mockRejectedValueOnce(Object.assign(new Error('PRIVATE_NATIVE_PATH_AND_CAUSE'), { code: 'EACCES' }));
  try { await f.call('src'); throw new Error('Expected permission failure'); }
  catch (error) {
    expect(error).toMatchObject({ code: 'PERMISSION_DENIED' }); expect(String(error)).not.toContain('PRIVATE_NATIVE');
  }
  expect(await f.call('src')).toMatchObject({ matches: [{ path: 'src/studio-example.ts' }] });
});

it('reports an exact-file read permission failure without swallowing it as an empty search', async () => {
  const f = await fixture();
  vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('PRIVATE_NATIVE_PATH_AND_CAUSE'), { code: 'EACCES' }));
  await expect(f.call('src/studio-example.ts')).rejects.toMatchObject({ code: 'PERMISSION_DENIED', message: expect.not.stringContaining('PRIVATE_NATIVE') });
  expect(await f.call('src/studio-example.ts')).toMatchObject({ matches: [{ path: 'src/studio-example.ts' }] });
});

it('keeps the existing match limit for one explicitly selected file', async () => {
  const f = await fixture(); await writeFile(join(f.root, 'src/many.ts'), Array.from({ length: 101 }, () => 'template').join('\n'));
  expect(await f.call('src/many.ts')).toMatchObject({ matches: expect.any(Array), truncated: true });
  expect(await f.call('src/many.ts')).toHaveProperty('matches.length', 100);
});
