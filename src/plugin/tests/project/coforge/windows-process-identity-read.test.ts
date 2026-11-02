import { afterEach, expect, it, vi } from 'vitest';
const { osCommand, cachedController } = vi.hoisted(() => ({ osCommand: vi.fn<(executable: string, args: readonly string[]) => { error?: Error; stdout: string }>(), cachedController: vi.fn<() => Promise<string | undefined>>() }));
vi.mock('node:child_process', () => ({
  execFile: (executable: string, args: readonly string[], _options: unknown, callback: (error: Error | null, stdout: string) => void) => {
    const result = osCommand(executable, args); callback(result.error ?? null, result.stdout);
  },
}));
vi.mock('../../../infrastructure/coforge/native-process/windows-controller', () => ({ existingWindowsControllerExecutable: cachedController, nativeSystemEnvironment: () => ({}) }));
import { readNativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';

const platform = Object.getOwnPropertyDescriptor(process, 'platform');
const pid = 444444;
function windows() {
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  cachedController.mockResolvedValue(undefined);
  osCommand.mockReturnValue({ stdout: JSON.stringify({ pid, birth: '100', image: 'C:\\Fixture\\node.exe' }) });
}
afterEach(() => { vi.restoreAllMocks(); osCommand.mockReset(); cachedController.mockReset(); if (platform) Object.defineProperty(process, 'platform', platform); });

it('avoids launching an identity helper only when Windows proves the PID absent with ESRCH', async () => {
  windows(); const probe = vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('Absent'), { code: 'ESRCH' }); });
  await expect(readNativeProcessIdentity(pid)).resolves.toBeUndefined();
  expect(probe).toHaveBeenCalledWith(pid, 0); expect(osCommand).not.toHaveBeenCalled();
  expect(cachedController).not.toHaveBeenCalled();
});

it('reads fresh OS birth and image after every successful PID probe instead of caching liveness as identity', async () => {
  windows(); const probe = vi.spyOn(process, 'kill').mockReturnValue(true);
  expect(await readNativeProcessIdentity(pid)).toMatchObject({ pid, platform: 'win32', birth: '100' });
  osCommand.mockReturnValue({ stdout: JSON.stringify({ pid, birth: '101', image: 'C:\\Fixture\\replacement.exe' }) });
  expect(await readNativeProcessIdentity(pid)).toMatchObject({ pid, platform: 'win32', birth: '101' });
  expect(probe).toHaveBeenCalledTimes(2); expect(osCommand).toHaveBeenCalledTimes(2);
});

it('keeps helper failures unverified and never treats permission errors as absence', async () => {
  windows(); const probe = vi.spyOn(process, 'kill').mockReturnValue(true);
  osCommand.mockReturnValue({ error: new Error('OS identity unavailable'), stdout: '' });
  await expect(readNativeProcessIdentity(pid)).rejects.toThrow('could not be verified');
  probe.mockImplementation(() => { throw Object.assign(new Error('Denied'), { code: 'EPERM' }); });
  await expect(readNativeProcessIdentity(pid)).rejects.toThrow('could not be verified');
  expect(osCommand).toHaveBeenCalledTimes(2);
});

it('uses a validated existing controller for fresh OS identity on each read without starting PowerShell', async () => {
  windows(); vi.spyOn(process, 'kill').mockReturnValue(true); cachedController.mockResolvedValue('C:\\Fixture\\Controller.exe');
  osCommand.mockReturnValue({ stdout: JSON.stringify({ pid, birth: '200', imagePath: 'C:\\Fixture\\node.exe' }) });
  const first = await readNativeProcessIdentity(pid);
  osCommand.mockReturnValue({ stdout: JSON.stringify({ pid, birth: '201', imagePath: 'C:\\Fixture\\replacement.exe' }) });
  const next = await readNativeProcessIdentity(pid);
  expect(first?.birth).toBe('200'); expect(next?.birth).toBe('201'); expect(next?.image).not.toBe(first?.image);
  expect(cachedController).toHaveBeenCalledTimes(2);
  expect(osCommand.mock.calls).toEqual([['C:\\Fixture\\Controller.exe', ['--identity', String(pid)]], ['C:\\Fixture\\Controller.exe', ['--identity', String(pid)]]]);
});

it('accepts explicit controller absence while refusing access-denied and malformed identity responses', async () => {
  windows(); vi.spyOn(process, 'kill').mockReturnValue(true); cachedController.mockResolvedValue('C:\\Fixture\\Controller.exe');
  osCommand.mockReturnValue({ stdout: 'null' }); await expect(readNativeProcessIdentity(pid)).resolves.toBeUndefined();
  for (const response of [{ error: new Error('Access denied'), stdout: '' }, { stdout: '{' }, { stdout: JSON.stringify({ pid, birth: '200', imagePath: '' }) }]) {
    osCommand.mockReturnValue(response); await expect(readNativeProcessIdentity(pid)).rejects.toThrow('could not be verified');
  }
  expect(osCommand).toHaveBeenCalledTimes(4);
});
