import { execFile } from 'node:child_process';
import { number, shape, text } from '../../../features/coforge/domain/check';
import { nativeProcessImageHash, type NativeProcessIdentity } from '../durable-worker/process-identity';
import { nativeSystemEnvironment } from './windows-controller';
import { OwnedWorktreeError } from './errors';

const pidCheck = number({ integer: true, min: 1, max: 2147483647 });
const recordCheck = shape({ pid: pidCheck, birth: text({ min: 1, max: 160, pattern: /^\d+$/u }), imagePath: text({ min: 1, max: 32000 }) }, { strict: true });
export interface PrivateWindowsIdentity { identity: NativeProcessIdentity; imagePath: string }

/** Raw OS path is transient and private. Persist only the established JavaScript fingerprint, never .NET case folding. */
export async function readWindowsNativeIdentity(executable: string, pid: number): Promise<PrivateWindowsIdentity | undefined> {
  pidCheck(pid);
  try {
    const raw = await new Promise<string>((resolve, reject) => execFile(executable, ['--identity', String(pid)],
      { env: nativeSystemEnvironment(), windowsHide: true, timeout: 5000, maxBuffer: 200000 }, (error, stdout) => error ? reject(new OwnedWorktreeError('controller_unavailable')) : resolve(stdout)));
    const value: unknown = JSON.parse(raw); if (value === null) return undefined;
    const record = recordCheck(value); if (record.pid !== pid) throw new OwnedWorktreeError('controller_unavailable');
    return { identity: { pid, platform: 'win32', birth: record.birth, image: nativeProcessImageHash(record.imagePath, 'win32') }, imagePath: record.imagePath };
  } catch { throw new OwnedWorktreeError('controller_unavailable'); }
}
