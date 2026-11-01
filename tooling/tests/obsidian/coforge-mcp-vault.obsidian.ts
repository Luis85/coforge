import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('CoForge vault MCP in contained Obsidian', () => {
  test('restores a contained MCP connection and authors notes atomically without client registration', async ({ obsidian }) => {
    const configDir = await obsidian.eval(({ app }) => app.vault.configDir);
    const directory = join(obsidian.vaultPath, configDir, 'plugins', obsidian.pluginId);
    const descriptor = join(directory, 'coforge-mcp-connection.json');
    const connectionCheck = (raw: unknown): { endpoint: string; token: string } => {
      if (!raw || typeof raw !== 'object' || !('endpoint' in raw) || !('token' in raw) || typeof raw.endpoint !== 'string' || typeof raw.token !== 'string') throw new Error('Missing contained MCP connection');
      return { endpoint: raw.endpoint, token: raw.token };
    };
    await expect.poll(async () => {
      try { await readFile(descriptor, 'utf8'); return true; } catch { return false; }
    }).toBe(true);
    await obsidian.disablePlugin();
    await expect.poll(async () => connectionCheck(JSON.parse(await readFile(descriptor, 'utf8'))).token.length).toBe(0);
    // Restore only a scratch-vault registration journal. Never activate MCP against
    // the operator's user settings or invoke the globally installed Obsidian CLI.
    const clientPath = join(obsidian.vaultPath, 'contained-client.json');
    await writeFile(join(directory, 'coforge-mcp-settings.json'), JSON.stringify({
      format: 'coforge-mcp/v1', acknowledgedTasks: [], registration: {
        name: 'coforge-contained', phase: 'active', paths: [join(obsidian.vaultPath, '.mcp.json'), clientPath],
        entry: { command: 'node', args: [join(directory, 'coforge-mcp-bridge.cjs'), descriptor] },
      },
    }));
    await obsidian.enablePlugin();
    await expect.poll(async () => connectionCheck(JSON.parse(await readFile(descriptor, 'utf8'))).token.length).toBeGreaterThan(0);
    let connection = connectionCheck(JSON.parse(await readFile(descriptor, 'utf8')));
    const initialToken = connection.token;
    await obsidian.reloadPlugin();
    await expect.poll(async () => {
      const next = connectionCheck(JSON.parse(await readFile(descriptor, 'utf8')));
      return next.token.length > 0 && next.token !== initialToken;
    }).toBe(true);
    connection = connectionCheck(JSON.parse(await readFile(descriptor, 'utf8')));
    const rpc = async (method: string, params: object = {}) => {
      const response = await fetch(connection.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      return response.json();
    };
    expect(await rpc('tools/list')).toMatchObject({ result: { tools: expect.arrayContaining([
      expect.objectContaining({ name: 'coforge_roster' }), expect.objectContaining({ name: 'coforge_dispatch_task' }),
      expect.objectContaining({ name: 'coforge_obsidian_cli' }), expect.objectContaining({ name: 'coforge_obsidian_note' }),
    ]) } });
    const note = { path: 'Assistant Notes/Atomic.md', content: '# Native note\r\n\r\nPreserve these bytes.\r\n', expectedContent: null };
    expect(await rpc('tools/call', { name: 'coforge_obsidian_note', arguments: note })).toMatchObject({ result: { structuredContent: { created: true, changed: true } } });
    expect(await readFile(join(obsidian.vaultPath, note.path), 'utf8')).toBe(note.content);
    expect(await rpc('tools/call', { name: 'coforge_obsidian_note', arguments: note })).toMatchObject({ result: { structuredContent: { created: false, changed: false } } });
    expect(await rpc('tools/call', { name: 'coforge_obsidian_note', arguments: { ...note, content: 'Stale overwrite' } })).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'CONFLICT' } } } });
    expect(await readFile(join(obsidian.vaultPath, note.path), 'utf8')).toBe(note.content);
    expect(await readFile(join(obsidian.vaultPath, 'Assistant Notes', '.gitignore'), 'utf8')).toContain('CoForge Council private data');
    await expect(readFile(clientPath, 'utf8')).rejects.toThrow();
    await expect(readFile(join(obsidian.vaultPath, '.mcp.json'), 'utf8')).rejects.toThrow();
    await obsidian.disablePlugin();
    await expect.poll(async () => connectionCheck(JSON.parse(await readFile(descriptor, 'utf8'))).token.length).toBe(0);
    expect(obsidian.errors()).toEqual([]);
  });
});
