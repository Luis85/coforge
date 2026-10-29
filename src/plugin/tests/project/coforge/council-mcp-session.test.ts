import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createCouncilMcpSession } from '../../../infrastructure/coforge/council-mcp-session';
import { record } from '../../../features/coforge/domain/check';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture(inputIds: string[] = []) {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-scoped-mcp-')); let valid = true;
  const session = await createCouncilMcpSession(directory, { prompt: 'Captured source and allowed context', instructions: 'Assess independently',
    identity: { projectId: 'CFP-001', runId: 'run-one', attemptId: 'attempt-one', agentId: 'architect', teamId: 'team-one', roundId: 'opinions' },
    inputs: inputIds.map(id => ({ id, agentId: 'reviewer', roundId: 'previous', markdown: 'Authorized previous contribution' })),
    recipients: () => ['reviewer'], recheck: async () => { if (!valid) throw new Error('Revoked'); } });
  cleanups.push(async () => { await session.dispose(); await rm(directory, { recursive: true, force: true }); });
  const config = record(JSON.parse(await readFile(session.configPath, 'utf8'))); const server = record(record(config.mcpServers).coforge); const headers = record(server.headers);
  const call = async (name: string, args: unknown = {}) => {
    const response = await fetch(String(server.url), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: String(headers.Authorization) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
    return record(await response.json());
  };
  return { session, call, revoke: () => { valid = false; } };
}
it('exposes captured context and bound inputs but rejects independent opinions and vault-wide actions', async () => {
  const f = await fixture();
  const context = record((await f.call('coforge_invocation')).result);
  expect(context).toMatchObject({ structuredContent: { projectId: 'CFP-001', prompt: 'Captured source and allowed context', inputArtifacts: [] } });
  for (const name of ['coforge_read_input', 'coforge_projects', 'coforge_begin_step', 'coforge_write_file', 'coforge_approve', 'coforge_roster', 'coforge_dispatch_task', 'coforge_run', 'coforge_artifact', 'coforge_obsidian_cli', 'coforge_obsidian_note']) {
    const result = record((await f.call(name, name === 'coforge_read_input' ? { artifactId: 'another-opinion' } : {})).result);
    expect(result.isError).toBe(true);
  }
  expect(f.session.messageDrafts()).toEqual([]);
});
it('reads only explicitly bound artifacts and stages idempotent agent nudges without dispatching them', async () => {
  const f = await fixture(['input-one']);
  expect(record((await f.call('coforge_read_input', { artifactId: 'input-one' })).result)).toMatchObject({ structuredContent: { id: 'input-one', markdown: 'Authorized previous contribution' } });
  const args = { requestId: 'nudge-one', recipientId: 'reviewer', prompt: 'Review the proposed boundary.' };
  await f.call('coforge_nudge_agent', args); await f.call('coforge_nudge_agent', args);
  expect(f.session.messageDrafts()).toEqual([{ purpose: 'request', recipientId: 'reviewer', body: args.prompt }]);
  expect(record((await f.call('coforge_nudge_agent', { ...args, recipientId: 'outsider' })).result).isError).toBe(true);
  f.revoke(); expect(record((await f.call('coforge_invocation')).result).isError).toBe(true);
});
