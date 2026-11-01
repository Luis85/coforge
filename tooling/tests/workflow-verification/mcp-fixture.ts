import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { record } from '../../../src/plugin/features/coforge/domain/check';

export interface FixtureBroker { url: string; token: string }
export async function callTool(broker: FixtureBroker, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(broker.url, { method: 'POST', headers: { Authorization: `Bearer ${broker.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  if (!response.ok) throw new Error('The fixture MCP request was rejected.');
  const json: unknown = await response.json(); const result = record(record(json).result);
  if (result.isError) throw new Error('The scoped broker refused the fixture operation.');
  return record(result.structuredContent);
}

/** The scripted provider fixture, rather than CoForge, launches its own native child client. */
export async function nativeFixtureChild(directory: string, broker: FixtureBroker, name: string, args: Record<string, unknown>): Promise<void> {
  const script = join(directory, 'native-fixture-child.mjs');
  await writeFile(script, `let raw=''; for await(const part of process.stdin) raw+=part; const request=JSON.parse(raw);
const response=await fetch(process.env.COFORGE_FIXTURE_BROKER,{method:'POST',headers:{Authorization:'Bearer '+process.env.COFORGE_FIXTURE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:request})});
const reply=await response.json(); if(!response.ok||reply.error||reply.result?.isError) process.exit(2);`, { flag: 'w' });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: directory, windowsHide: true, shell: false, stdio: ['pipe', 'ignore', 'ignore'], env: { PATH: process.env.PATH, COFORGE_FIXTURE_BROKER: broker.url, COFORGE_FIXTURE_TOKEN: broker.token } });
    const timer = setTimeout(() => { child.kill(); reject(new Error('The fixture native child exceeded its finite allowance.')); }, 30000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('The fixture native child was refused by the shared broker.')); });
    child.stdin.end(JSON.stringify({ name, arguments: args }));
  });
}
