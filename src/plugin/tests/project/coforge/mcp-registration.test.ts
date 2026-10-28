import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { McpRegistration } from '../../../infrastructure/coforge/mcp-registration';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge-mcp-config-')); folders.push(root);
  const project = join(root, '.mcp.json'); const user = join(root, '.claude.json');
  const entry = { command: 'node', args: ['/plugin/bridge.cjs', '/plugin/private.json', 'CFP-001'] };
  return { root, project, user, entry, registration: new McpRegistration() };
}
it('registers both scopes preserving unrelated keys and removes only the exact owned entry', async () => {
  const f = await fixture();
  const before = { mcpServers: { existing: { command: 'other' } }, other: { enabled: true } };
  await writeFile(f.project, JSON.stringify(before));
  await writeFile(f.user, JSON.stringify({ projects: { '/other': { trust: true } }, mcpServers: { another: {} } }));
  await f.registration.install([f.project, f.user], 'coforge-test', f.entry);
  expect(JSON.parse(await readFile(f.project, 'utf8'))).toEqual({ ...before, mcpServers: { ...before.mcpServers, 'coforge-test': f.entry } });
  expect(JSON.parse(await readFile(f.user, 'utf8'))).toMatchObject({ projects: { '/other': { trust: true } }, mcpServers: { another: {}, 'coforge-test': f.entry } });
  await f.registration.remove([f.project, f.user], 'coforge-test', f.entry);
  expect(JSON.parse(await readFile(f.project, 'utf8'))).toEqual(before);
});
it('preflights all files and refuses malformed JSON, conflicting registrations or external edits', async () => {
  const f = await fixture();
  await writeFile(f.project, '{"keep":true}');
  await writeFile(f.user, 'invalid-json');
  await expect(f.registration.install([f.project, f.user], 'coforge-test', f.entry)).rejects.toThrow();
  expect(await readFile(f.project, 'utf8')).toBe('{"keep":true}');
  await writeFile(f.user, JSON.stringify({ mcpServers: { 'coforge-test': { command: 'owned-by-user' } } }));
  await expect(f.registration.install([f.project, f.user], 'coforge-test', f.entry)).rejects.toThrow();
  await expect(f.registration.remove([f.project, f.user], 'coforge-test', f.entry)).rejects.toThrow();
  expect(await readFile(f.project, 'utf8')).toBe('{"keep":true}');
});
