import { expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import { inspectVerificationRuntime, recoverVerificationRuntime } from '../../../src/plugin/infrastructure/coforge/verification/runtime';
import { verificationFixture } from './fixture';

it('bounds final UTF-8 evidence and aggregate output without killing a healthy noisy test', async () => {
  const f = await verificationFixture(`process.stdout.write('界'.repeat(100000)); console.log('fixture reached normal completion');`, { maxRuns: 9 });
  const session = await f.open();
  for (let index = 0; index < 9; index++) {
    const result = await session.run({ commandId: 'check' });
    expect(result).toMatchObject({ status: 'completed', exitCode: 0, truncated: true });
    expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(8192);
  }
  expect(session.records().reduce((bytes, item) => bytes + Buffer.byteLength(item.output), 0)).toBeLessThanOrEqual(65536);
  await f.assertSourceUnchanged();
});

it('terminates timed-out commands and detached descendants with the original container, preserving an interrupted outcome', async () => {
  const f = await verificationFixture(`const cp=require('node:child_process'); cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'}).unref(); console.log('DETACHED_CHILD_STARTED'); setInterval(()=>{},1000);`);
  const session = await f.open(); const result = await session.run({ commandId: 'check' });
  expect(result.status).toBe('interrupted'); expect(result.exitCode).toBe(124);
  const original = f.currentRuntime(); if (!original) throw new Error('Original container identity missing.');
  expect(original.phase).toBe('terminal');
  expect(await inspectVerificationRuntime(original)).toBe('missing');
  await expect(access(f.verificationDirectory(original.verificationId))).rejects.toThrow();
});

it('refuses wrong ownership proof before signals and cancels only the original owned running container', async () => {
  const f = await verificationFixture(`console.log('RUNNING'); setInterval(()=>{},1000);`, { timeoutSeconds: 30 });
  const controller = new AbortController(); f.input.signal = controller.signal;
  const session = await f.open(); const pending = session.run({ commandId: 'check' }); void pending.catch(() => undefined);
  await expect.poll(async () => {
    const runtime = f.currentRuntime(); if (!runtime || runtime.phase !== 'started') return false;
    const state = await inspectVerificationRuntime(runtime); return state !== 'missing' && state.State.Running;
  }, { timeout: 15000, interval: 200 }).toBe(true);
  const original = f.currentRuntime(); if (!original) throw new Error('Original container ownership missing.');
  expect(await recoverVerificationRuntime({ ...original, ownerToken: '0'.repeat(64) })).toBe('unknown');
  const stillRunning = await inspectVerificationRuntime(original);
  expect(stillRunning !== 'missing' && stillRunning.State.Running).toBe(true);
  controller.abort(); const result = await pending;
  expect(result.status).toBe('interrupted');
  expect(f.currentRuntime()?.phase).toBe('terminal');
  expect(await inspectVerificationRuntime(original)).toBe('missing');
});
