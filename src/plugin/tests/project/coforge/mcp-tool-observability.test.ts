import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { LocalMcpServer } from '../../../infrastructure/coforge/mcp-server';
import { codexWorkflowTools } from '../../../infrastructure/coforge/codex-workflow-tools';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { AgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import { codexSessionEvents } from '../../../infrastructure/coforge/codex-session-events';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose(); });
async function fixture(observer?: StageInput['onSessionEvent'], onActivity?: () => Promise<void>, provider: 'claude' | 'codex' = 'claude') {
  await mkdir('.nq', { recursive: true });
  const root = await mkdtemp(join(resolve('.nq'), 'mcp-tool-observation-'));
  cleanup.push(async () => {
    if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(join(root, 'public.ts'), 'export const useful = true;\n');
  const events: AgentSessionEvent[] = [];
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], lifecycle: { version: 1, mode: 'managed-session' },
      step: { id: 'refine', name: 'Refinement', kind: 'ai', provider, model: 'sonnet', instructions: 'Inspect source', output: 'markdown', access: 'readproject', automatic: false } },
    onSessionEvent: observer ?? (async event => { events.push(event); }) };
  const bridge = await codexWorkflowTools(input, { cwd: root, readOnly: true, protectedProjectPaths: [], validate: async () => {}, capture: async () => undefined, release: async () => {} }, [], onActivity);
  cleanup.push(bridge.dispose);
  const send = async (name: string, args: unknown) => {
    const result = await fetch(bridge.url, { method: 'POST', headers: { Authorization: `Bearer ${bridge.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'call', method: 'tools/call', params: { name, arguments: args } }) });
    return result.json();
  };
  return { send, events, bridge };
}

it('retains safe host-observed completed and failed scoped tools when the SDK feed only contains starts', async () => {
  const f = await fixture();
  expect(await f.send('coforge_read_file', { path: 'public.ts' })).toMatchObject({ result: { structuredContent: { content: 'export const useful = true;\n' } } });
  expect(await f.send('coforge_read_file', { path: '../private-secret.ts' })).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'PERMISSION_DENIED' } } } });
  expect(f.events).toEqual([
    expect.objectContaining({ kind: 'tool', tool: 'mcp__coforge__coforge_read_file', status: 'completed' }),
    expect.objectContaining({ kind: 'tool', tool: 'mcp__coforge__coforge_read_file', status: 'failed', text: expect.stringContaining('PERMISSION_DENIED') }),
  ]);
  expect(JSON.stringify(f.events)).not.toContain('public.ts');
  expect(JSON.stringify(f.events)).not.toContain('private-secret');
  expect(JSON.stringify(f.events)).not.toContain('export const');
  expect(await f.send('coforge_list_files', {})).toMatchObject({ result: { structuredContent: { files: ['public.ts'] } } });
});

it('does not let observation persistence change a scoped result or its deliberate error', async () => {
  const observe = vi.fn(async () => { throw new Error('Private observation sink failed'); });
  const f = await fixture(observe);
  expect(await f.send('coforge_read_file', { path: 'public.ts' })).not.toHaveProperty('result.isError');
  expect(await f.send('coforge_read_file', { path: '../denied' })).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'PERMISSION_DENIED' } } } });
  expect(observe).toHaveBeenCalledTimes(2);
});

it('records one uncertain outcome when required activity persistence fails after a file operation', async () => {
  const f = await fixture(undefined, async () => { throw new Error('C:/private/worker-state token=PRIVATE'); });
  expect(await f.send('coforge_read_file', { path: 'public.ts' })).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'HOST_UNAVAILABLE' } } } });
  expect(f.events).toEqual([expect.objectContaining({ kind: 'tool', status: 'unknown', text: expect.stringContaining('HOST_UNAVAILABLE') })]);
  expect(JSON.stringify(f.events)).not.toMatch(/worker-state|token|PRIVATE|public.ts/);
});

it('keeps the SDK as the Codex terminal observation source without duplicating the same MCP completion', async () => {
  const f = await fixture(undefined, undefined, 'codex');
  const sdk = codexSessionEvents(event => { f.events.push(event); });
  sdk({ type: 'thread.started', thread_id: 'root' });
  sdk({ type: 'item.started', item: { type: 'mcp_tool_call', tool: 'coforge_read_file' } });
  await f.send('coforge_read_file', { path: 'public.ts' });
  sdk({ type: 'item.completed', item: { type: 'mcp_tool_call', tool: 'coforge_read_file', status: 'completed' } });
  expect(f.events.filter(event => event.kind === 'tool').map(event => event.status)).toEqual(['running', 'completed']);
});

it('bounds slow observation persistence and finishes the bridge without draining unlimited queued writes', async () => {
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const observed: AgentSessionEvent[] = [];
  const f = await fixture(async event => { observed.push(event); if (event.kind === 'tool') await held; });
  try {
    for (let i = 0; i < 80; i++) expect(await f.send('coforge_list_files', {})).not.toHaveProperty('result.isError');
    expect(observed.filter(event => event.kind === 'tool')).toHaveLength(1);
    await f.bridge.dispose();
    expect(observed).toContainEqual(expect.objectContaining({ kind: 'notice', status: 'unknown' }));
    const count = observed.length;
    release(); await new Promise(resolve => setTimeout(resolve, 20));
    expect(observed).toHaveLength(count);
  } finally { release(); }
});

it('gives an unexpected server-side failure a safe structured cause and keeps later requests usable', async () => {
  let fail = true;
  const server = new LocalMcpServer({ tools: () => [], call: async () => { if (fail) throw new Error('C:/private/credentials.txt Bearer secret-value'); return { ok: true }; } });
  cleanup.push(() => server.close());
  const token = server.allow(), endpoint = await server.listen();
  const call = async () => (await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'inspect', arguments: {} } }) })).json();
  const result = await call();
  expect(result).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'HOST_UNAVAILABLE' } } } });
  expect(JSON.stringify(result)).not.toMatch(/credentials|Bearer|secret-value/);
  fail = false;
  expect(await call()).toMatchObject({ result: { structuredContent: { ok: true } } });
});
