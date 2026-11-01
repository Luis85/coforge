import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { captureProcess } from '../../../infrastructure/coforge/process';
import { ClaudeSessionResult } from '../../../infrastructure/coforge/claude-stream-result';

it('publishes stdout before provider close without observational failures changing the process result', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-stream-test-'));
  const received: number[] = []; let closed = false;
  try {
    const raw = await captureProcess(process.execPath, ['-e', "process.stdout.write('first');setTimeout(()=>process.stdout.write('second'),80)"], {
      cwd: directory, onStdout: async chunk => { expect(closed).toBe(false); received.push(chunk.length); throw new Error('Observer unavailable'); },
    });
    closed = true; expect(raw).toBe('firstsecond'); expect(received.length).toBeGreaterThan(0);
    const again = await captureProcess(process.execPath, ['-e', "process.stdout.write('unchanged')"], { cwd: directory, onStdout: () => { throw new Error('Observer failed synchronously'); } });
    expect(again).toBe('unchanged');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('retains bounded terminal semantics without killing a provider for verbose observation records', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-stream-test-'));
  const projection = new ClaudeSessionResult();
  const script = "process.stdout.write(JSON.stringify({type:'system',subtype:'init',session_id:'root'})+'\\n');for(let i=0;i<600;i++)process.stdout.write(JSON.stringify({type:'assistant',message:{content:[{type:'thinking',thinking:'PRIVATE_REASONING'+('x'.repeat(4000))}]}})+'\\n');process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,session_id:'root',structured_output:{summary:'done'}})+'\\n')";
  try {
    const raw = await captureProcess(process.execPath, ['-e', script], { cwd: directory, maxBytes: 4096, stdoutResult: projection });
    expect(JSON.parse(raw)).toMatchObject({ type: 'result', is_error: false, structured_output: { summary: 'done' } });
    expect(raw).not.toContain('PRIVATE_REASONING');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
