import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { nativeSystemEnvironment } from './windows-controller';
import { OwnedWorktreeError } from './errors';

/** Resolve PATH outside the agent working tree; never evaluate a shell wrapper or command string. */
export async function ownedNativeExecutable(input: string): Promise<string> {
  if (isAbsolute(input)) return realpath(input).catch(() => { throw new OwnedWorktreeError('executable_unavailable'); });
  if (process.platform !== 'win32' || !/^[A-Za-z0-9_.-]+$/u.test(input)) throw new OwnedWorktreeError('executable_unavailable');
  const where = join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'where.exe');
  const output = await new Promise<string>((resolve, reject) => execFile(where, [input], { cwd: tmpdir(), env: nativeSystemEnvironment(), windowsHide: true, timeout: 5000, maxBuffer: 16000 },
    (error, stdout) => error ? reject(new OwnedWorktreeError('executable_unavailable')) : resolve(stdout)));
  const match = output.split(/\r?\n/u).find(path => /\.exe$/iu.test(path.trim()));
  if (!match) throw new OwnedWorktreeError('executable_unavailable');
  return realpath(match.trim());
}
