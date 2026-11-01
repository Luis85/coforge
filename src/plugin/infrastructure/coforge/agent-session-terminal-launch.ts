import { execFile } from 'node:child_process';
import { basename, join } from 'node:path';
import { nativeWorkerNode } from './durable-worker/node-runtime';
import { WorkerFiles } from './durable-worker/files';
import { number, shape } from '../../features/coforge/domain/check';

const allowedEnvironment = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'TEMP', 'TMP', 'TMPDIR']);
export function sessionTerminalEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => allowedEnvironment.has(key.toUpperCase()) && value !== undefined));
}
export interface AgentSessionTerminalHandle { isOpen(): Promise<boolean> }
export class SessionTerminalNotStarted extends Error {}
export class SessionTerminalLaunchUnknown extends Error {
  constructor() { super('The read-only terminal launch could not be confirmed. Use Peek; the agent is unaffected.'); }
}
const observerCheck = shape({ pid: number({ integer: true, min: 1, max: 2147483647 }) }, { strict: true });
function present(pid: number): boolean {
  // Zero-signal existence checks only. A live or reused PID conservatively retains the observer feed.
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(error instanceof Error && 'code' in error && error.code === 'ESRCH'); }
}
const windowScript = String.raw`$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'launch.json') -Encoding UTF8 -Raw | ConvertFrom-Json
[Console]::Title = 'CoForge read-only session ' + $config.observerId
$env:COFORGE_FOLLOW_COLUMNS = [string][Console]::WindowWidth
& $config.node (Join-Path $PSScriptRoot 'follow.cjs') (Join-Path $PSScriptRoot 'feed.json')
exit $LASTEXITCODE
`;
const launchScript = String.raw`$ErrorActionPreference = 'Stop'
$arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'window.ps1') + '"'))
$observer = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Normal -ArgumentList $arguments -PassThru
Write-Output $observer.Id
`;

/** Start one visible, noninteractive observer console. Neither executable nor arguments come from a session event. */
async function prepareTerminal(directory: string, configuredNode: string | undefined, platform: string) {
  if (platform !== 'win32') throw new SessionTerminalNotStarted('Read-only terminal follow is currently supported on Windows desktop. Use Peek to read these observations here.');
  const environment = sessionTerminalEnvironment();
  const node = await nativeWorkerNode(configuredNode ?? 'node', environment);
  const files = new WorkerFiles(directory); await files.attach();
  await files.create('launch.json', { node: node.executable, observerId: basename(files.directory).slice(-6) });
  await files.createSource('window.ps1', windowScript); await files.createSource('launch.ps1', launchScript);
  const powershell = join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return { files, powershell, environment };
}
export async function launchAgentSessionTerminal(directory: string, configuredNode?: string, platform: string = process.platform): Promise<AgentSessionTerminalHandle> {
  const { files, powershell, environment } = await prepareTerminal(directory, configuredNode, platform).catch(error => {
    if (error instanceof SessionTerminalNotStarted) throw error;
    throw new SessionTerminalNotStarted('The read-only terminal could not be prepared. Check the native Node.js setting or use Peek.');
  });
  const pid = await new Promise<number>((resolve, reject) => execFile(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', files.path('launch.ps1')],
    { cwd: files.directory, env: environment, windowsHide: true, timeout: 10000, maxBuffer: 4000 }, (error, stdout) => {
      const value = Number(stdout.trim());
      if (error || !Number.isSafeInteger(value) || value < 1) reject(new Error('The read-only terminal could not open. Peek retains the same observations.'));
      else resolve(value);
    })).catch(() => { throw new SessionTerminalLaunchUnknown(); });
  let closed = false;
  return { isOpen: async () => {
    if (closed) return false;
    if (present(pid)) return true;
    try {
      const value = await files.read('observer.json', 1024);
      // The fixed Node observer records its PID before following. It exits if that receipt cannot be written.
      if (value !== undefined && present(observerCheck(value).pid)) return true;
      closed = true; return false;
    } catch { return true; /* Retain an uncertain observer rather than multiplying or deleting its feed. */ }
  } };
}
