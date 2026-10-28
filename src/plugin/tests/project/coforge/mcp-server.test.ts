import { afterEach, expect, it } from 'vitest';
import { request } from 'node:http';
import { LocalMcpServer } from '../../../infrastructure/coforge/mcp-server';

const servers: LocalMcpServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.close())); });
async function fixture() {
  const calls: unknown[] = [];
  const server = new LocalMcpServer({
    tools: () => [{ name: 'inspect', description: 'Inspect project', inputSchema: { type: 'object', properties: {} } }],
    call: async (name, args) => { calls.push({ name, args }); return { ok: true }; },
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
