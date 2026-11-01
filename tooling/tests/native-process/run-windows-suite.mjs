import { execFile, spawn } from 'node:child_process';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { release } from 'node:os';

if (process.platform !== 'win32') throw new Error('Native Windows acceptance requires Windows; no skipped substitute is accepted.');
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'));
const run = (executable, args, options = {}) => new Promise((resolve, reject) => execFile(executable, args, { cwd: root, windowsHide: true, maxBuffer: 16000, ...options },
  (error, stdout) => error ? reject(error) : resolve(stdout)));
const system = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows';
const powershell = join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const isAdmin = (await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', '[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'])).trim() === 'True';
const environment = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined &&
  ['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CI'].includes(key.toUpperCase())));
const vitest = join(root, 'node_modules/vitest/vitest.mjs');
await mkdir(join(root, 'reports/native-process'), { recursive: true });
await writeFile(join(root, 'reports/native-process/environment.json'), JSON.stringify({ platform: process.platform, release: release(), node: process.version,
  parentAdmin: isAdmin, childMode: isAdmin ? 'same-user-restricted-token' : 'current-non-admin', modelCalls: 0 }, null, 2));
let executable = process.execPath, args = [vitest, 'run', '--config', 'configs/testing/vitest.native-process.config.mjs'];
if (isAdmin) {
  const target = join(root, '.nq/native-process-ci'); await mkdir(target, { recursive: true });
  const user = (await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'])).trim();
  if (!/^S-1-5-(?:\d+-)+\d+$/u.test(user)) throw new Error('CI current-user identity is invalid.');
  // Only this ephemeral checkout receives a same-user Modify ACE. No accounts/global security settings change.
  await run(join(system, 'System32/icacls.exe'), [root, '/grant', `*${user}:(OI)(CI)M`, '/T', '/Q'], { timeout: 120000 });
  executable = join(target, 'RestrictedAcceptance.exe');
  await run(join(system, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'), ['/nologo', '/target:exe', '/out:' + executable,
    ...['restricted-test-runner.cs', 'restricted-test-token.cs', 'restricted-test-probe.cs'].map(file => join(root, 'tooling/tests/native-process', file))], { env: environment, timeout: 20000 });
  args = [process.execPath, vitest, root];
}
const child = spawn(executable, args, { cwd: root, env: environment, windowsHide: true, stdio: 'inherit', shell: false });
child.once('error', () => { process.exitCode = 1; });
child.once('close', code => { process.exitCode = code ?? 1; });
