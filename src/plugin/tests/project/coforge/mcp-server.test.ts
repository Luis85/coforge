import { afterEach, expect, it, vi } from 'vitest';
import { request } from 'node:http';
import { LocalMcpServer } from '../../../infrastructure/coforge/mcp-server';
import { ProviderFailureError, providerFailureFor } from '../../../features/coforge/domain/provider-failure';

const servers: LocalMcpServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.close())); });
async function fixture(result: unknown = { ok: true }, availableTools = ['inspect']) {
  const calls: unknown[] = [];
  const server = new LocalMcpServer({
    tools: () => availableTools.map(name => ({ name, description: 'Inspect project', inputSchema: { type: 'object', properties: {} } })),
    call: async (name, args) => { calls.push({ name, args }); if (result instanceof Error) throw result; return result; },
  });
  servers.push(server);
  const endpoint = await server.listen();
  const token = server.allow();
  const send = (body: unknown, headers: Record<string, string> = {}) => fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body),
  });
  return { server, endpoint, token, send, calls };
}
it('negotiates one vault MCP endpoint, discovers tools and forwards explicit project arguments', async () => {
  const f = await fixture();
  const init = await f.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  expect(await init.json()).toMatchObject({ id: 1, result: { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'coforge' } } });
  expect((await f.send({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
  const listed = await f.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  expect(await listed.json()).toMatchObject({ result: { tools: [{ name: 'inspect' }] } });
  const call = await f.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'inspect', arguments: { projectId: 'CFP-001' } } });
  expect(await call.json()).toMatchObject({ result: { content: [{ type: 'text', text: '{"ok":true}' }] } });
  expect(f.calls).toEqual([{ name: 'inspect', args: { projectId: 'CFP-001' } }]);
});
it('exposes a safe typed execution failure with an actionable next tool instead of discarding its cause', async () => {
  const f = await fixture(new ProviderFailureError(providerFailureFor('ownership_unknown')), ['inspect', 'coforge_request_status']);
  const response = await f.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'coforge_submit_result', arguments: { projectId: 'CFP-001', taskId: 'task', output: {} } } });
  expect(await response.json()).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'HOST_UNAVAILABLE', nextTool: 'coforge_request_status' } } } });
});
it('does not direct a private invocation to a recovery tool that this server does not expose', async () => {
  const f = await fixture(new ProviderFailureError(providerFailureFor('ownership_unknown')));
  const response = await f.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'inspect', arguments: {} } });
  const result = await response.json();
  expect(result).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'HOST_UNAVAILABLE' } } } });
  expect(result.result.structuredContent.error).not.toHaveProperty('nextTool');
});
it('preserves the original safe failure when optional next-tool discovery is unavailable', async () => {
  const server = new LocalMcpServer({ tools: () => { throw new Error('Private extension teardown'); },
    call: async () => { throw new ProviderFailureError(providerFailureFor('ownership_unknown')); } });
  servers.push(server); const endpoint = await server.listen(), token = server.allow();
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'inspect', arguments: {} } }) });
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ result: { isError: true, structuredContent: { error: { code: 'HOST_UNAVAILABLE' } } } });
  expect(JSON.stringify(result)).not.toContain('Private extension');
});
it('answers parallel tool pressure with a bounded not-started response instead of resetting agent connections', async () => {
  let release = () => {}, entered = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const server = new LocalMcpServer({ tools: () => [], call: async () => { entered++; await held; return { ok: true }; } });
  servers.push(server); const endpoint = await server.listen(), token = server.allow();
  const calls = Array.from({ length: 40 }, (_, id) => fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'inspect', arguments: {} } }) })
    .then(async response => ({ status: response.status, body: await response.json(), reset: false }), () => ({ status: 0, body: undefined, reset: true })));
  try {
    await vi.waitFor(() => expect(entered).toBeGreaterThan(0));
    await new Promise(resolve => setTimeout(resolve, 100));
    release(); const results = await Promise.all(calls);
    expect(results.some(result => result.reset)).toBe(false);
    expect(entered).toBeLessThanOrEqual(32);
    expect(results.every(result => result.status === 200)).toBe(true);
    const busy = results.filter(result => result.body?.result?.isError);
    expect(busy.length).toBeGreaterThan(0);
    for (const result of busy) expect(result.body).toMatchObject({ result: { structuredContent: { error: { code: 'HOST_UNAVAILABLE', requestNotStarted: true, retryAfterMs: 1000 } } } });
    const later = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 41, method: 'tools/call', params: { name: 'inspect', arguments: {} } }) });
    expect(await later.json()).toMatchObject({ result: { structuredContent: { ok: true } } });
  } finally { release(); await Promise.all(calls); }
});
it('reserves bounded status and cancellation capacity while work is saturated', async () => {
  let releaseWork = () => {}, releaseControls = () => {}, entered = 0, heldControls = 0;
  const work = new Promise<void>(resolve => { releaseWork = resolve; }), controls = new Promise<void>(resolve => { releaseControls = resolve; });
  const server = new LocalMcpServer({ tools: () => [], call: async name => {
    if (name === 'work') { entered++; await work; }
    if (name === 'coforge_command_status') { heldControls++; await controls; }
    return { observed: name };
  } });
  servers.push(server); const endpoint = await server.listen(), token = server.allow();
  const call = async (name: string) => (await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } }) })).json();
  const workers = Array.from({ length: 32 }, () => call('work'));
  const waiting: Array<Promise<unknown>> = [];
  try {
    await vi.waitFor(() => expect(entered).toBe(32));
    expect(await call('coforge_request_status')).toMatchObject({ result: { structuredContent: { observed: 'coforge_request_status' } } });
    waiting.push(...Array.from({ length: 4 }, () => call('coforge_command_status')));
    await vi.waitFor(() => expect(heldControls).toBe(4));
    expect(await call('coforge_cancel_step')).toMatchObject({ result: { isError: true, structuredContent: { error: { requestNotStarted: true } } } });
    releaseControls(); await Promise.all(waiting);
    expect(await call('coforge_cancel_step')).toMatchObject({ result: { structuredContent: { observed: 'coforge_cancel_step' } } });
  } finally { releaseWork(); releaseControls(); await Promise.all([...workers, ...waiting]); }
});
it('returns a generated artifact as MCP image content without duplicating its base64 in structured text', async () => {
  const f = await fixture({ kind: 'image', path: 'proof.png', mimeType: 'image/png', data: 'aW1hZ2U=', width: 1, height: 1, sha256: 'a'.repeat(64) });
  const response = await f.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'coforge_read_artifact', arguments: { projectId: 'CFP-001', taskId: 'task', path: 'proof.png' } } });
  const body = await response.json();
  expect(body.result.content[1]).toEqual({ type: 'image', data: 'aW1hZ2U=', mimeType: 'image/png' });
  expect(body.result.structuredContent).toMatchObject({ path: 'proof.png', width: 1, height: 1 });
  expect(body.result.structuredContent).not.toHaveProperty('data');
  expect(body.result.content[0].text).not.toContain('aW1hZ2U=');
});
it('rejects unauthorized, obsolete project endpoints, hostile origins/hosts and revoked access before dispatch', async () => {
  const f = await fixture();
  const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
  expect((await f.send(body, { Authorization: 'Bearer wrong' })).status).toBe(401);
  expect((await f.send(body, { Origin: 'https://evil.example' })).status).toBe(403);
  const hostileHost = await new Promise<number | undefined>((resolve, reject) => {
    const call = request(f.endpoint, { method: 'POST', headers: { Host: 'evil.example' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    call.on('error', reject); call.end(JSON.stringify(body));
  });
  expect(hostileHost).toBe(403);
  expect((await fetch(f.endpoint + '/CFP-002', { method: 'POST', headers: { Authorization: `Bearer ${f.token}` }, body: JSON.stringify(body) })).status).toBe(404);
  f.server.revoke();
  expect((await f.send(body)).status).toBe(401);
  expect(f.calls).toEqual([]);
});
it('returns bounded protocol errors and refuses unsupported versions and oversized messages', async () => {
  const f = await fixture();
  expect((await f.send({}, { 'MCP-Protocol-Version': 'unsupported' })).status).toBe(400);
  const invalid = await f.send({ jsonrpc: '2.0', id: 4, method: 'unknown' });
  expect(await invalid.json()).toMatchObject({ error: { code: -32601 } });
  const malformed = await f.send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: {} });
  expect(await malformed.json()).toMatchObject({ error: { code: -32602 } });
  expect((await f.send({ value: 'x'.repeat(1024 * 1024 + 1) })).status).toBe(413);
});
