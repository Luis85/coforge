import { afterEach, expect, it, vi } from 'vitest';
const probe = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('node:child_process', async original => ({ ...(await original<typeof import('node:child_process')>()), execFile: probe.exec }));
import { nativeProcessImageHash } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { readWindowsNativeIdentity } from '../../../infrastructure/coforge/native-process/windows-identity';

afterEach(() => vi.resetAllMocks());
it.each([
  ['C:\\Synthetic\\İ\\ΟΣ\\Controller.exe', '1e896bfc2c4dfadafdb2f07c23a18c61c148cb9a5c71330f250b3b3729909036'],
  ['C:\\Synthetic\\é\\Controller.exe', '6338fd86b4a97ef3ce8ea06486adaffc65ab540ebb3dc54d8fa940d942e335d5'],
])('preserves the existing JavaScript Unicode image fingerprint (%s)', (path, expected) => {
  expect(nativeProcessImageHash(path, 'win32')).toBe(expected);
});
it('keeps the queried path private and exposes only the established OS identity fields', async () => {
  probe.exec.mockImplementation((_file, _args, _options, callback) => callback(null, JSON.stringify({ pid: 123, birth: '456', imagePath: 'C:\\Synthetic\\İ\\ΟΣ\\Controller.exe' })));
  const value = await readWindowsNativeIdentity('trusted-controller.exe', 123);
  expect(value?.identity).toEqual({ pid: 123, platform: 'win32', birth: '456', image: '1e896bfc2c4dfadafdb2f07c23a18c61c148cb9a5c71330f250b3b3729909036' });
  expect(JSON.stringify(value?.identity)).not.toContain('Synthetic');
});
it('distinguishes a verified absent process from an unreadable original identity', async () => {
  probe.exec.mockImplementationOnce((_file, _args, _options, callback) => callback(null, 'null'));
  expect(await readWindowsNativeIdentity('trusted-controller.exe', 123)).toBeUndefined();
  probe.exec.mockImplementationOnce((_file, _args, _options, callback) => callback(new Error('PRIVATE_PATH_PERMISSION_CAUSE'), ''));
  await expect(readWindowsNativeIdentity('trusted-controller.exe', 123)).rejects.toMatchObject({ code: 'controller_unavailable' });
});
it.each(['{ "imagePath": "PRIVATE_NATIVE_PATH" invalid', JSON.stringify({ pid: 999, birth: '456', imagePath: 'PRIVATE_NATIVE_PATH' })])('never publishes malformed or foreign identity payloads', async raw => {
  probe.exec.mockImplementation((_file, _args, _options, callback) => callback(null, raw));
  try { await readWindowsNativeIdentity('trusted-controller.exe', 123); }
  catch (error) { expect(JSON.stringify(error)).not.toContain('PRIVATE_NATIVE_PATH'); expect(error).toMatchObject({ code: 'controller_unavailable' }); return; }
  throw new Error('Malformed identity was accepted');
});
