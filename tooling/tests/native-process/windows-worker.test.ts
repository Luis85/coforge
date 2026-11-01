import { afterEach, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { WorkerFiles } from '../../../src/plugin/infrastructure/coforge/durable-worker/files';
import type { WorkerHooks } from '../../../src/plugin/infrastructure/coforge/durable-worker/service';
import { captureWorkerNativeCoding } from '../../../src/plugin/infrastructure/coforge/durable-worker/native-coding-process';
import { cleanupNativeFixtures, nativeProcessFixture } from './fixture';

if (process.platform !== 'win32') throw new Error('Native Windows worker qualification requires Windows; no skipped substitute qualifies it.');
afterEach(cleanupNativeFixtures);

it('retains the latest genuine native Claude continuation through the durable fallback without recording thinking or tool arguments', async () => {
  const f = await nativeProcessFixture();
  const files = new WorkerFiles(join(f.directory, 'private-worker')); await files.initialize();
  const result = (summary: string, cost: number) => ({ type: 'result', session_id: 'root', subtype: 'success', is_error: false,
    structured_output: { summary }, total_cost_usd: cost });
  const frames = [
    { type: 'system', subtype: 'init', session_id: 'root' },
    { type: 'assistant', session_id: 'root', message: { content: [
      { type: 'thinking', thinking: 'PRIVATE_THINKING_CANARY' },
      { type: 'tool_use', name: 'Agent', id: 'toolu_native', input: { prompt: 'PRIVATE_ARGUMENT_CANARY' } },
    ] } },
    result('Early root result', 0.1),
    { type: 'system', subtype: 'task_notification', session_id: 'root', tool_use_id: 'toolu_native' },
    { type: 'system', subtype: 'init', session_id: 'root' },
    result('Completed native child work', 0.2),
  ].map(frame => JSON.stringify(frame)).join('\n') + '\n';
  await writeFile(f.script, `process.stdin.resume();process.stdin.on('end',()=>{if(!require('node:fs').existsSync(${JSON.stringify(files.path('provider.json'))}))process.exit(2);process.stdout.write(${JSON.stringify(frames)});});`);
  const noop = async () => {};
  const hooks: WorkerHooks = { signal: new AbortController().signal, activity: noop, phase: noop, workspace: noop, changes: noop,
    conversation: noop, usage: noop, cost: noop, log: noop,
    launched: async (pid, launchId, identity, lifetime) => { await files.write('provider.json', { pid, launchId, identity, lifetime }); } };
  const phases: string[] = [];
  const raw = await captureWorkerNativeCoding(files, hooks, 'claude', process.execPath, [f.script], { cwd: f.directory, input: 'Synthetic task',
    maxBytes: 4096, nativeCoding: { runId: 'synthetic-run', attemptId: 'synthetic-attempt', projectId: 'synthetic-project' },
    onOwnedProcess: async (_identity, phase) => { phases.push(phase); } });
  expect(JSON.parse(raw)).toMatchObject({ structured_output: { summary: 'Completed native child work' }, total_cost_usd: 0.2, is_error: false });
  expect(phases).toEqual(['launched', 'terminated']);
  const spool = await readFile(files.path('stdout-0.log'), 'utf8');
  expect(spool).toBe(raw); expect(spool).not.toMatch(/PRIVATE_THINKING_CANARY|PRIVATE_ARGUMENT_CANARY|Early root result/u);
});
