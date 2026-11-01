import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { workerCapture } from '../../../infrastructure/coforge/durable-worker/process';
import type { WorkerHooks } from '../../../infrastructure/coforge/durable-worker/service';
import { captureObservedClaude } from '../../../infrastructure/coforge/claude-observed-capture';
import type { AgentSessionEvent } from '../../../features/coforge/domain/agent-session';

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
function hooks(): WorkerHooks {
  return { signal: new AbortController().signal, activity: async () => {}, phase: async () => {}, workspace: async () => {}, changes: async () => {},
    conversation: async () => {}, usage: async () => {}, cost: async () => {}, launched: async () => {}, log: async () => {} };
}

it.each(['sync', 'async'] as const)('observes a real worker stdout stream without %s observer failure stopping or replaying the provider', async failure => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-session-')); folders.push(directory);
  const files = new WorkerFiles(directory); await files.initialize();
  const observed: string[] = [];
  const observer = vi.fn((chunk: Uint8Array) => {
    observed.push(Buffer.from(chunk).toString('utf8'));
    if (failure === 'sync') throw new Error('Synthetic observer failure');
    return Promise.reject(new Error('Synthetic observer failure'));
  });
  const source = 'process.stdin.resume();process.stdin.on("end",()=>{process.stdout.write(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"{\\"summary\\":\\"Complete\\"}"}})+"\\n");});';
  const result = await workerCapture(files, hooks(), 'codex')(process.execPath, ['-e', source], { cwd: directory, onStdout: observer });
  expect(result).toContain('Complete'); expect(observer).toHaveBeenCalled(); expect(observed.join('')).toContain('item.completed');
  const logs = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.log')).map(name => readFile(join(directory, name), 'utf8')));
  expect(logs.join('')).not.toContain('Synthetic observer failure');
}, 15000);

it('projects verbose real Claude-shaped worker output to root semantics while keeping thinking, arguments and private initialization out of journal logs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-session-')); folders.push(directory);
  const files = new WorkerFiles(directory); await files.initialize(); const events: AgentSessionEvent[] = [];
  const source = [
    'process.stdin.resume();process.stdin.on("end",()=>{',
    'const emit=value=>process.stdout.write(JSON.stringify(value)+"\\n");',
    'emit({type:"system",subtype:"init",session_id:"root",cwd:"C:/PRIVATE_INITIALIZATION_PATH",system_prompt:"DO_NOT_PERSIST_PROMPT"});',
    'emit({type:"assistant",session_id:"root",message:{content:[{type:"thinking",thinking:"DO_NOT_PERSIST_THINKING"+"x".repeat(2400000)}]}});',
    'emit({type:"assistant",session_id:"root",message:{content:[{type:"tool_use",name:"mcp__coforge__coforge_read_file",input:{private:"DO_NOT_PERSIST_ARGUMENTS"}}]}});',
    'emit({type:"assistant",session_id:"root",message:{content:[{type:"text",text:"Visible parent progress"}]}});',
    'emit({type:"result",session_id:"root",subtype:"success",is_error:false,structured_output:{summary:"Complete"},total_cost_usd:0.1});',
    '});',
  ].join('');
  const result = await captureObservedClaude({ onSessionEvent: async event => { events.push(event); } }, process.execPath, ['--output-format', 'json'],
    { cwd: directory, maxBytes: 4096 }, async (_command, args, options) => {
      expect(args).toContain('stream-json');
      return workerCapture(files, hooks(), 'claude')(process.execPath, ['-e', source], options);
    });
  expect(JSON.parse(result)).toMatchObject({ structured_output: { summary: 'Complete' }, total_cost_usd: 0.1 });
  expect(events.some(event => event.kind === 'message' && event.text === 'Visible parent progress')).toBe(true);
  const logs = (await Promise.all((await readdir(directory)).filter(name => name.endsWith('.log')).map(name => readFile(join(directory, name), 'utf8')))).join('');
  for (const privateValue of ['PRIVATE_INITIALIZATION_PATH', 'DO_NOT_PERSIST_PROMPT', 'DO_NOT_PERSIST_THINKING', 'DO_NOT_PERSIST_ARGUMENTS']) {
    expect(logs).not.toContain(privateValue); expect(JSON.stringify(events)).not.toContain(privateValue);
  }
}, 15000);
