import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { stopHost, treeKillCommand } from '../testing/obsidian-host.mjs';
import { closeHostClient } from '../testing/obsidian-session.mjs';

test('[OBSIDIAN-SHUTDOWN-01] stops the tracked host tree before CDP can close the Electron main process', async () => {
  const calls = [];
  const proc = { pid: 123, exitCode: null, signalCode: null };
  const client = { proc, browser: { close: async () => { calls.push('cdp-close'); proc.exitCode = 0; } } };
  await closeHostClient(client, { stop: async child => { assert.equal(child, proc); assert.equal(child.exitCode, null); calls.push('tree-stop'); } });
  assert.deepEqual(calls, ['tree-stop', 'cdp-close']);
});
test('[OBSIDIAN-SHUTDOWN-02] still disconnects CDP and preserves a host termination failure', async () => {
  const failure = new Error('tree failure');
  let closed = false;
  await assert.rejects(closeHostClient({ proc: {}, browser: { close: async () => { closed = true; } } }, { stop: async () => { throw failure; } }),
    error => error instanceof AggregateError && error.errors[0] === failure);
  assert.equal(closed, true);
});
test('[OBSIDIAN-SHUTDOWN-03] waits for pipe closure after process exit before declaring shutdown complete', async () => {
  const proc = Object.assign(new EventEmitter(), { pid: 123, exitCode: null, signalCode: null });
  const calls = [];
  const stopping = stopHost(proc, 200, { signalTree: (_child, name) => {
    calls.push(name);
    queueMicrotask(() => { proc.exitCode = 0; proc.emit('exit', 0); });
    setTimeout(() => { calls.push('pipes-closed'); proc.emit('close', 0); }, 15);
  } });
  assert.deepEqual(await stopping, { stopped: true, signal: 'SIGTERM' });
  assert.deepEqual(calls, ['SIGTERM', 'pipes-closed']);
});
test('[OBSIDIAN-SHUTDOWN-04] does not re-signal a dead main PID when inherited pipes remain held', async () => {
  const proc = Object.assign(new EventEmitter(), { pid: 123, exitCode: null, signalCode: null });
  const calls = [];
  await assert.rejects(stopHost(proc, 15, { signalTree: (_child, name) => {
    calls.push(name); proc.exitCode = 0; proc.emit('exit', 0);
  } }), /OBSIDIAN_STOP_TIMEOUT/);
  assert.deepEqual(calls, ['SIGTERM']);
});
test('[OBSIDIAN-SHUTDOWN-05] numeric process identity is required for Windows tree termination', () => {
  for (const pid of [0, -1, undefined, NaN, '123', '123 /IM Obsidian.exe']) assert.throws(() => treeKillCommand(pid), /OBSIDIAN_PROCESS_ID_INVALID/);
  assert.deepEqual(treeKillCommand(123), { command: 'taskkill', args: ['/T', '/F', '/PID', '123'] });
});
