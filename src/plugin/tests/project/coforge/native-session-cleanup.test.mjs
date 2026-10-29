import { expect, it, vi } from 'vitest';
import { join, resolve } from 'node:path';
import { cleanupNativeSession, stopNativeSessionHost } from '../../../../../tooling/testing/obsidian-session-cleanup.mjs';
import { closeHostClient } from '../../../../../tooling/testing/obsidian-session.mjs';

function fixture() {
  const root = resolve('owned-coforge-fixture');
  const scratch = join(root, '.nq', 'abcdef');
  const profile = join(scratch, 'obsidian-launcher-config-fixture');
  const executable = join(root, '.native-cache', 'obsidian-installer', 'Obsidian.exe');
  const proc = { pid: 321, exitCode: null, signalCode: null, spawnfile: executable, spawnargs: [executable, `--user-data-dir=${profile}`, '--remote-debugging-port=12345'] };
  const state = { scratch, port: 12345, launched: { proc, configDir: profile } };
  const validateProfile = vi.fn(async value => value);
  const validate = vi.fn(async value => value);
  const remove = vi.fn(async () => {});
  return { root, state, proc, ports: { root, validateProfile, validate, remove }, remove };
}

it('preserves the complete owned scratch directory when stopping the host fails', async () => {
  const f = fixture(); const stopFailure = new Error('OBSIDIAN_STOP_TIMEOUT');
  const stop = vi.fn(async () => { throw stopFailure; });
  await expect(cleanupNativeSession(f.state, { ...f.ports, stop })).rejects.toMatchObject({ message: 'OBSIDIAN_SESSION_CLEANUP_FAILED', errors: [stopFailure] });
  expect(f.remove).not.toHaveBeenCalled();
  expect(f.state.cleanup).toEqual({ stopped: false, scratchPreserved: true });
});

it('retains a failed stop even if CDP closure subsequently exits the main PID', async () => {
  const f = fixture(); const stopFailure = new Error('tree still has helpers');
  const stop = vi.fn(async () => { throw stopFailure; });
  await expect(closeHostClient({ proc: f.proc, browser: { close: async () => { f.proc.exitCode = 0; } } }, { stop: () => stopNativeSessionHost(f.state, { ...f.ports, stop }) })).rejects.toMatchObject({ message: 'OBSIDIAN_CLIENT_CLOSE_FAILED' });
  await expect(cleanupNativeSession(f.state, { ...f.ports, stop })).rejects.toMatchObject({ errors: [stopFailure] });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(f.remove).not.toHaveBeenCalled();
});

it('checks the contained profile and launch identity before stopping only its owned child', async () => {
  const f = fixture(); const order = [];
  const stop = vi.fn(async proc => { expect(proc).toBe(f.proc); order.push('stop'); return { stopped: true }; });
  const validateProfile = vi.fn(async value => { order.push('profile'); return value; });
  const remove = vi.fn(async path => { expect(path).toBe(f.state.scratch); order.push('remove'); });
  await cleanupNativeSession(f.state, { ...f.ports, stop, validateProfile, remove });
  expect(order).toEqual(['profile', 'stop', 'remove']);
  expect(f.state.processIdentity).toMatchObject({ pid: 321, profile: f.state.launched.configDir, port: 12345 });
  expect(f.state.cleanup).toEqual({ stopped: true, scratchPreserved: false });
});

it.each(['profile', 'executable', 'port'])('never stops or removes a session with a mismatched %s', async field => {
  const f = fixture();
  if (field === 'profile') f.state.launched.configDir = join(f.state.scratch, 'obsidian-launcher-config-other');
  if (field === 'executable') f.proc.spawnfile = join(f.root, 'foreign-host', 'Obsidian.exe');
  if (field === 'port') f.state.port = 9999;
  const stop = vi.fn(async () => ({ stopped: true }));
  await expect(cleanupNativeSession(f.state, { ...f.ports, stop })).rejects.toMatchObject({ message: 'OBSIDIAN_SESSION_CLEANUP_FAILED' });
  expect(stop).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
});

it('does not remove scratch after an unconfirmed stop response', async () => {
  const f = fixture(); const stop = vi.fn(async () => ({ stopped: false }));
  await expect(cleanupNativeSession(f.state, { ...f.ports, stop })).rejects.toMatchObject({ errors: [expect.objectContaining({ message: 'OBSIDIAN_STOP_UNCONFIRMED' })] });
  expect(f.remove).not.toHaveBeenCalled();
});

it('stops once before CDP disconnect and then removes only the validated scratch directory', async () => {
  const f = fixture(); const order = [];
  const stop = vi.fn(async () => { order.push('stop'); return { stopped: true }; });
  await closeHostClient({ proc: f.proc, browser: { close: async () => { order.push('disconnect'); } } }, { stop: () => stopNativeSessionHost(f.state, { ...f.ports, stop }) });
  await cleanupNativeSession(f.state, { ...f.ports, stop, remove: async () => { order.push('remove'); } });
  expect(stop).toHaveBeenCalledTimes(1); expect(order).toEqual(['stop', 'disconnect', 'remove']);
});

it('preserves explicit keep-scratch and reports removal failures without suppressing them', async () => {
  const kept = fixture(); const stop = async () => ({ stopped: true });
  await cleanupNativeSession(kept.state, { ...kept.ports, stop, keepScratch: true });
  expect(kept.remove).not.toHaveBeenCalled(); expect(kept.state.cleanup.scratchPreserved).toBe(true);
  const failed = fixture(); const removalFailure = new Error('owned directory is locked');
  await expect(cleanupNativeSession(failed.state, { ...failed.ports, stop, remove: async () => { throw removalFailure; } })).rejects.toMatchObject({ errors: [removalFailure] });
  expect(failed.state.cleanup).toEqual({ stopped: true, scratchPreserved: true });
});
