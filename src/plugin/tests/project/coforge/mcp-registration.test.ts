import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { McpRegistration } from '../../../infrastructure/coforge/mcp-registration';
import { assertOwnedMcpRelocation } from '../../../infrastructure/coforge/mcp-data-relocation';

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

it('relocates only the exact owned entry in both scopes and resumes after a partial relocation', async () => {
  const f = await fixture();
  const next = { command: 'node', args: ['/vault/.coforge-data/integrations/mcp/bridge.cjs', '/vault/.coforge-data/integrations/mcp/connection.json'] };
  const keep = { projects: { other: { trusted: true } } };
  await writeFile(f.project, JSON.stringify({ ...keep, mcpServers: { coforge: f.entry } }));
  await writeFile(f.user, JSON.stringify({ ...keep, mcpServers: { coforge: next } }));
  await f.registration.relocate([f.project, f.user], 'coforge', f.entry, next);
  for (const path of [f.project, f.user]) expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ...keep, mcpServers: { coforge: next } });
  await f.registration.relocate([f.project, f.user], 'coforge', f.entry, next);
  const human = JSON.stringify({ mcpServers: { coforge: { command: 'human' } } });
  await writeFile(f.user, human);
  await expect(f.registration.relocate([f.project, f.user], 'coforge', next, f.entry)).rejects.toThrow();
  expect(await readFile(f.user, 'utf8')).toBe(human);
  expect(JSON.parse(await readFile(f.project, 'utf8')).mcpServers.coforge).toEqual(next);
});

it('does not turn a relocated vault journal into implicit activation or arbitrary settings writes', async () => {
  const f = await fixture();
  const vault = join(f.root, 'vault'), directory = join(vault, '.obsidian', 'plugins', 'coforge');
  const entry = { command: 'node', args: [join(directory, 'coforge-mcp-bridge.cjs'), join(directory, 'coforge-mcp-connection.json')] };
  const saved = { paths: [join(vault, '.mcp.json'), f.user], entry };
  expect(() => assertOwnedMcpRelocation(saved, vault, directory, f.user)).not.toThrow();
  expect(() => assertOwnedMcpRelocation({ ...saved, paths: [saved.paths[0]!, join(f.root, 'other.json')] }, vault, directory, f.user)).toThrow('no client configuration');
  expect(() => assertOwnedMcpRelocation({ ...saved, entry: { ...entry, command: 'other' } }, vault, directory, f.user)).toThrow();
  await writeFile(f.project, JSON.stringify({ mcpServers: { coforge: f.entry } }));
  const before = await readFile(f.project, 'utf8');
  await expect(f.registration.relocate([f.project, f.user], 'coforge', f.entry, entry)).rejects.toThrow();
  expect(await readFile(f.project, 'utf8')).toBe(before);
  await expect(readFile(f.user)).rejects.toThrow();
});
