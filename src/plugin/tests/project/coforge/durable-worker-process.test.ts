import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { workerCapture } from '../../../infrastructure/coforge/durable-worker/process';
import type { WorkerHooks } from '../../../infrastructure/coforge/durable-worker/service';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true }); });
function hooks(signal: AbortSignal): WorkerHooks { return { signal, activity: vi.fn(async () => {}), phase: vi.fn(async () => {}), workspace: async () => {}, changes: async () => {}, conversation: async () => {}, usage: async () => {}, cost: async () => {}, launched: vi.fn(async () => {}), log: async () => {} }; }
it('handles more than 2MiB without terminating a real child and retains only bounded, user-visible semantic evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-stream-')); folders.push(directory);
  const files = new WorkerFiles(directory); await files.initialize();
  const context = hooks(new AbortController().signal);
  const source = [
    'process.stdout.write(JSON.stringify({type:"noise",text:"x".repeat(3000000)})+"\\n");',
    'process.stdout.write(JSON.stringify({type:"item.completed",item:{type:"reasoning",text:"DO_NOT_PERSIST_REASONING"}})+"\\n");',
    'process.stdout.write(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"{\\"summary\\":\\"Complete\\"}"}})+"\\n");',
    'process.stdout.write(JSON.stringify({type:"turn.completed",usage:{input_tokens:10,cached_input_tokens:0,output_tokens:3}})+"\\n");',
  ].join('');
  const result = await workerCapture(files, context, 'codex')(process.execPath, ['-e', 'process.stdin.resume();process.stdin.on("end",()=>{' + source + '});'], { cwd: files.directory });
  expect(result).toContain('Complete'); expect(result).toContain('turn.completed');
  expect(context.launched).toHaveBeenCalled(); expect(context.activity).toHaveBeenCalled(); expect(context.phase).toHaveBeenCalled();
  const paths = (await readdir(files.directory)).filter(path => path.endsWith('.log'));
  const content = (await Promise.all(paths.map(path => readFile(join(files.directory, path), 'utf8')))).join('');
  expect(content).not.toContain('DO_NOT_PERSIST_REASONING');
  const sizes = await Promise.all(paths.map(path => stat(join(files.directory, path))));
  expect(sizes.reduce((total, info) => total + info.size, 0)).toBeLessThan(8 * 1024 * 1024);
}, 15000);
it('cancels a real bounded native child and waits for its termination result', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-cancel-')); folders.push(directory);
  const files = new WorkerFiles(directory); await files.initialize(); const controller = new AbortController(); const context = hooks(controller.signal);
  const running = workerCapture(files, context, 'claude')(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: files.directory, signal: controller.signal });
  const rejected = expect(running).rejects.toThrow(/cancelled|termination|process tree/u);
  await vi.waitFor(() => expect(context.launched).toHaveBeenCalled(), { timeout: 10000 }); controller.abort(); await rejected;
}, 20000);
