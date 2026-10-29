// @vitest-environment happy-dom
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
const processOutput = vi.hoisted(() => {
  const state: { stdout: string; error: Error | null; calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> } = { stdout: '', error: null, calls: [] };
  return state;
});
vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFile: (command: string, args: string[], options: Record<string, unknown>, callback: (error: Error | null, stdout: string) => void) => {
    processOutput.calls.push({ command, args, options });
    callback(processOutput.error, processOutput.stdout);
  },
}));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { executeObsidianCli, McpObsidianTools } from '../../../infrastructure/coforge/mcp-obsidian-tools';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of cleanup.splice(0)) await stop(); });
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-cli-')));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'Notes'));
  await writeFile(join(root, 'Notes', 'Existing.md'), 'Human text.\r\n');
  const app = new App();
  const kit = createTestApp({ app, files: { 'Notes/Existing.md': 'Human text.\r\n' } });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  let reportedRoot = root;
  const run = vi.fn(async (args: string[], cwd: string) => {
    expect(cwd).toBe(root);
    expect(args[0]).toBe('vault=contained-vault-id');
    if (args[1] === 'vault') return reportedRoot + '\n';
    if (args[1] === 'version') return '1.14.4\n';
    if (args[1] === 'read') return 'Human text.\r\n';
    return 'Notes/Existing.md\n';
  });
  const authorize = vi.fn(() => {});
  const tools = new McpObsidianTools(plugin, { identity: () => ({ root, selector: 'contained-vault-id', name: 'Contained' }), run, authorize, publicFolder: () => 'CoForge/Public', blockedWriteFolders: () => ['CoForge', 'Managed'] });
  return { root, tools, run, kit, app, authorize, wrongVault: () => { reportedRoot = join(root, 'another'); } };
}
it('pins every CLI call to the current vault and returns supported capabilities', async () => {
  const f = await fixture();
  expect(await f.tools.call('coforge_obsidian_status', {})).toMatchObject({ available: true, version: '1.14.4', vault: 'Contained' });
  expect(await f.tools.call('coforge_obsidian_cli', { command: 'read', path: 'Notes/Existing.md' })).toMatchObject({ output: 'Human text.\r\n' });
  expect(f.run.mock.calls.at(-1)?.[0]).toEqual(['vault=contained-vault-id', 'read', 'path=Notes/Existing.md']);
});
it('rejects a mismatched vault before invoking the requested command', async () => {
  const f = await fixture(); f.wrongVault();
  await expect(f.tools.call('coforge_obsidian_cli', { command: 'search', query: 'hello' })).rejects.toThrow(/vault/i);
  expect(f.run.mock.calls.every(([args]) => args[1] === 'vault')).toBe(true);
});
it('rejects routing overrides, arbitrary commands, traversal, metadata and unknown arguments before spawning', async () => {
  const f = await fixture();
  for (const args of [
    { command: 'eval', code: 'anything' }, { command: 'command', id: 'coforge:accept' },
    { command: 'read', path: '../personal.md' }, { command: 'read', path: '.obsidian/data.md' },
    { command: 'read', path: 'Notes/Existing.md', vault: 'Other' }, { command: 'read' },
    { command: 'read', path: 'Notes/Existing.md', flags: ['--copy'] },
  ]) await expect(f.tools.call('coforge_obsidian_cli', args)).rejects.toThrow();
  expect(f.run).not.toHaveBeenCalled();
});
it('edits ordinary Markdown through atomic host preconditions and preserves competing edits', async () => {
  const f = await fixture();
  const args = { path: 'Notes/Existing.md', content: 'Human text.\r\nAssistant addition.\r\n', expectedContent: 'Human text.\r\n' };
  expect(await f.tools.call('coforge_obsidian_note', args)).toMatchObject({ changed: true });
  expect(f.kit.read(args.path)).toBe(args.content);
  const process = vi.spyOn(f.app.vault, 'process');
  expect(await f.tools.call('coforge_obsidian_note', args)).toMatchObject({ changed: false });
  expect(process).not.toHaveBeenCalled();
  await expect(f.tools.call('coforge_obsidian_note', { ...args, content: 'Stale overwrite' })).rejects.toThrow(/changed/i);
  expect(f.kit.read(args.path)).toBe(args.content);
  expect(f.run).not.toHaveBeenCalled();
});
it('creates ordinary notes without overwrites and blocks managed, watched or public destinations', async () => {
  const f = await fixture();
  expect(await f.tools.call('coforge_obsidian_note', { path: 'Notes/New.md', content: 'Private authored note.', expectedContent: null })).toMatchObject({ created: true });
  for (const path of ['CoForge/Ideas/request.md', 'Managed/Agent.md', 'CoForge/Public/output.md', '.obsidian/test.md'])
    await expect(f.tools.call('coforge_obsidian_note', { path, content: 'Override', expectedContent: null })).rejects.toThrow();
  expect(f.kit.read('Notes/New.md')).toBe('Private authored note.');
});
it('rejects an edit racing the atomic host callback and keeps the human bytes', async () => {
  const f = await fixture();
  const process = f.app.vault.process.bind(f.app.vault);
  vi.spyOn(f.app.vault, 'process').mockImplementationOnce(async (file, callback) => {
    await f.app.vault.modify(file, 'A concurrent human edit.\r\n');
    return process(file, callback);
  });
  await expect(f.tools.call('coforge_obsidian_note', { path: 'Notes/Existing.md', content: 'Assistant replacement', expectedContent: 'Human text.\r\n' })).rejects.toThrow(/changed/i);
  expect(f.kit.read('Notes/Existing.md')).toBe('A concurrent human edit.\r\n');
});
it('cancels queued CLI work when MCP is revoked and keeps missing-CLI failures actionable', async () => {
  const f = await fixture();
  const queued = f.tools.call('coforge_obsidian_cli', { command: 'search', query: 'hello' });
  f.tools.revoke();
  await expect(queued).rejects.toThrow();
  expect(f.run).not.toHaveBeenCalled();
  f.run.mockRejectedValue(new Error('Raw secret process failure'));
  expect(await f.tools.call('coforge_obsidian_status', {})).toMatchObject({ available: false, nextAction: expect.stringContaining('Command line interface') });
  await expect(f.tools.call('coforge_obsidian_cli', { command: 'search', query: 'hello' })).rejects.toThrow();
});
it('rejects linked note paths and treats query text as one value rather than routing arguments', async () => {
  const f = await fixture();
  const other = await mkdtemp(join(tmpdir(), 'coforge-cli-outside-'));
  cleanup.push(() => rm(other, { recursive: true, force: true }));
  await writeFile(join(other, 'Outside.md'), 'Outside the current vault');
  await symlink(other, join(f.root, 'Notes', 'Linked'), 'junction');
  await expect(f.tools.call('coforge_obsidian_cli', { command: 'read', path: 'Notes/Linked/Outside.md' })).rejects.toThrow();
  expect(f.run).not.toHaveBeenCalled();
  const query = 'hello" vault=Other & eval';
  await f.tools.call('coforge_obsidian_cli', { command: 'search', query, folder: 'Notes' });
  expect(f.run.mock.calls.at(-1)?.[0]).toEqual(['vault=contained-vault-id', 'search', 'path=Notes', `query=${query}`, 'limit=100']);
});
it('runs without a shell, preserves note text beginning with Error and withholds native failure causes', async () => {
  const signal = new AbortController().signal;
  processOutput.stdout = 'Error: this is ordinary note content.\n';
  expect(await executeObsidianCli(['vault=current', 'read', 'path=Notes/Test.md'], '/contained', signal)).toBe(processOutput.stdout);
  expect(processOutput.calls.at(-1)).toMatchObject({ command: 'obsidian', options: { shell: false, windowsHide: true, timeout: 6000, maxBuffer: 200000, cwd: '/contained', signal } });
  processOutput.error = new Error('A secret native cause');
  await expect(executeObsidianCli(['vault=current', 'read', 'path=Notes/Test.md'], '/contained', signal)).rejects.toMatchObject({ code: 'HOST_UNAVAILABLE', message: expect.not.stringContaining('secret') });
  processOutput.error = null;
});
it('excludes custom non-hidden Obsidian configuration folders before launching the CLI', async () => {
  const f = await fixture();
  Object.defineProperty(f.app.vault, 'configDir', { value: 'Notes' });
  await expect(f.tools.call('coforge_obsidian_cli', { command: 'read', path: 'Notes/Existing.md' })).rejects.toThrow(/configuration/);
  await expect(f.tools.call('coforge_obsidian_cli', { command: 'files', folder: 'Notes' })).rejects.toThrow(/configuration/);
  await expect(f.tools.call('coforge_obsidian_cli', { command: 'search', query: 'private' })).rejects.toThrow(/configuration/);
  expect(f.run).not.toHaveBeenCalled();
});
it('returns exact host content for editing even when the CLI adds a trailing newline', async () => {
  const f = await fixture();
  f.run.mockImplementation(async args => args[1] === 'vault' ? f.root : 'Human text.\r\n\n');
  const reply = await f.tools.call('coforge_obsidian_cli', { command: 'read', path: 'Notes/Existing.md' });
  expect(reply).toMatchObject({ output: 'Human text.\r\n\n', content: 'Human text.\r\n' });
  expect(await f.tools.call('coforge_obsidian_note', { path: 'Notes/Existing.md', expectedContent: 'Human text.\r\n', content: 'Human text.\r\nAdded.' })).toMatchObject({ changed: true });
});
