/** Shipped inside main.js and materialized in the plugin folder on explicit activation. No package download. */
export const MCP_BRIDGE_SOURCE = String.raw`'use strict';
const fs = require('node:fs/promises');
const http = require('node:http');
const [descriptor] = process.argv.slice(2);
if (!descriptor) process.exit(1);
let buffer = '';
let pending = Promise.resolve();
const reply = message => process.stdout.write(JSON.stringify(message) + '\n');
async function forward(line) {
  let message;
  try { message = JSON.parse(line); } catch { reply({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }); return; }
  try {
    const data = JSON.parse(await fs.readFile(descriptor, 'utf8'));
    if (!/^http:\/\/127\.0\.0\.1:\d+\/mcp$/.test(data.endpoint) || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error('offline');
    const body = JSON.stringify(message);
    const response = await new Promise((resolve, reject) => {
      const request = http.request(data.endpoint, { method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + data.token,
        'Content-Length': Buffer.byteLength(body), 'MCP-Protocol-Version': '2025-11-25'
      } }, response => {
        let result = ''; let size = 0;
        response.setEncoding('utf8');
        response.on('data', chunk => { size += Buffer.byteLength(chunk); if (size > 4 * 1024 * 1024) { response.destroy(); reject(new Error('large')); } else result += chunk; });
        response.on('end', () => { if (response.statusCode === 202) resolve(null); else if (response.statusCode !== 200) reject(new Error('offline')); else { try { resolve(JSON.parse(result)); } catch { reject(new Error('invalid')); } } });
        response.on('error', reject);
      });
      request.setTimeout(60000, () => request.destroy(new Error('timeout')));
      request.on('error', reject); request.end(body);
    });
    if (response) reply(response);
  } catch {
    if (message.id !== undefined) reply({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'CoForge MCP is unavailable. Open the vault, enable CoForge and activate MCP in plugin settings. Inspect pending attempts before retrying mutations.' } });
  }
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  if (Buffer.byteLength(buffer) > 1024 * 1024) { process.stderr.write('MCP input exceeds 1 MiB.\n'); process.exit(1); }
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
    if (line) pending = pending.then(() => forward(line));
  }
});
process.stdin.on('end', () => { if (buffer.trim()) pending = pending.then(() => forward(buffer)); void pending.finally(() => process.exit(0)); });
`;
