import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { number, shape, text } from '../../../features/coforge/domain/check';

export interface NativeProcessIdentity { pid: number; platform: string; birth: string; image: string; groupId?: number }
export interface ProcessTerminationProof { state: 'terminated' | 'absent' | 'different' | 'unverified'; treeConfirmed: boolean; observedAt: string; reason?: string }
export interface ProcessIdentityDriver { read(pid: number): Promise<NativeProcessIdentity | undefined>; terminate(identity: NativeProcessIdentity): Promise<boolean> }
const unavailable = () => new Error('The original native process identity could not be verified. No unrelated process was signalled.');
class ProcessIdentityIssue extends Error { constructor(readonly reason: string) { super('Native process proof is incomplete.'); } }
const pidCheck = number({ integer: true, min: 1, max: 2147483647 });
export const nativeProcessImageHash = (path: string, platform = process.platform) => createHash('sha256').update(platform === 'win32' ? path.normalize().toLowerCase() : path).digest('hex');
const imageHash = nativeProcessImageHash;
const systemEnvironment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'windir', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'].includes(key)));
function command(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile(executable, args, { windowsHide: true, timeout: 10000, maxBuffer: 64000,
    env: { ...systemEnvironment(), LC_ALL: 'C', TZ: 'UTC' } }, (error, stdout) => error ? reject(unavailable()) : resolve(stdout)));
}
const powershell = () => join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const ps = (source: string) => command(powershell(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', source]);
const windowsRecord = shape({ pid: pidCheck, birth: text({ min: 1, max: 160, pattern: /^\d+$/u }), image: text({ min: 1, max: 32000 }) }, { strict: true });

/** Birth tokens come from the OS, not the task's wall clock or an audit-only launch nonce. */
export async function readNativeProcessIdentity(pid: number): Promise<NativeProcessIdentity | undefined> {
  pidCheck(pid);
  if (process.platform === 'win32') {
    const raw = await ps(`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue;if($null -eq $p){'null';exit 0};try{if(-not $p.Path){throw 'identity'};@{pid=$p.Id;birth=$p.StartTime.ToUniversalTime().Ticks.ToString();image=$p.Path}|ConvertTo-Json -Compress}finally{$p.Dispose()}`);
    const value: unknown = JSON.parse(raw); if (value === null) return undefined;
    const record = windowsRecord(value); if (record.pid !== pid) throw unavailable();
    return { pid, platform: process.platform, birth: record.birth, image: imageHash(record.image) };
  }
  if (process.platform === 'linux') {
    try {
      const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
      if (fields[0] === 'Z') return undefined;
      if (!/^\d+$/u.test(fields[19] ?? '')) throw unavailable();
      const [boot, image] = await Promise.all([readFile('/proc/sys/kernel/random/boot_id', 'utf8'), readlink(`/proc/${pid}/exe`)]);
      return { pid, platform: process.platform, birth: `${boot.trim()}:${fields[19]}`, image: imageHash(image), groupId: pidCheck(Number(fields[2])) };
    } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined; throw unavailable(); }
  }
  if (process.platform === 'darwin') {
    const output = await command('/bin/ps', ['-ww', '-p', String(pid), '-o', 'lstart=', '-o', 'pgid=', '-o', 'comm=']).catch(() => undefined);
    if (!output?.trim()) { try { process.kill(pid, 0); } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return undefined; } throw unavailable(); }
    const match = output.trim().match(/^(.{24})\s+(\d+)\s+(.+)$/u); if (!match) throw unavailable();
    return { pid, platform: process.platform, birth: match[1]!, groupId: pidCheck(Number(match[2])), image: imageHash(match[3]!) };
  }
  throw unavailable();
}
export const sameNativeProcessIdentity = (a: NativeProcessIdentity, b: NativeProcessIdentity): boolean => a.pid === b.pid && a.platform === b.platform && a.birth === b.birth && a.image === b.image;

async function terminate(identity: NativeProcessIdentity): Promise<boolean> {
  if (process.platform === 'win32') {
    if (!/^\d+$/u.test(identity.birth) || !/^[a-f0-9]{64}$/u.test(identity.image)) return false;
    // Hold the original process handle while checking and terminating its tree.
    // It is never closed/reopened by PID between the birth check and taskkill.
    const raw = await ps(`$ErrorActionPreference='Stop';$p=$null;try{$p=Get-Process -Id ${identity.pid} -ErrorAction SilentlyContinue;if($null -eq $p){'absent';exit 0};$held=$p.Handle;$birth=$p.StartTime.ToUniversalTime().Ticks.ToString();$sha=[Security.Cryptography.SHA256]::Create();try{$image=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($p.Path.Normalize().ToLowerInvariant())))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()};if($birth -ne '${identity.birth}'){'birth-mismatch';exit 0};if($image -ne '${identity.image}'){'image-mismatch';exit 0};& (Join-Path $env:SystemRoot 'System32/taskkill.exe') /PID ${identity.pid} /T /F | Out-Null;if($LASTEXITCODE -ne 0){'tree-failed';exit 0};if($p.WaitForExit(5000)){'confirmed'}else{'wait-failed'}}catch{'helper-error:'+($_.FullyQualifiedErrorId.Split(',')[0])}finally{if($null -ne $p){$p.Dispose()}}`).catch(() => { throw new ProcessIdentityIssue('helper-exit'); });
    const result = raw.trim();
    if (result === 'confirmed') return true;
    throw new ProcessIdentityIssue(/^(?:absent|birth-mismatch|image-mismatch|tree-failed|wait-failed|helper-error:[A-Za-z0-9_.-]{1,80})$/u.test(result) ? result : 'helper-unverified');
  }
  if (identity.groupId !== identity.pid) return false;
  const current = await readNativeProcessIdentity(identity.pid);
  if (!current || !sameNativeProcessIdentity(identity, current) || current.groupId !== identity.groupId) return false;
  try { process.kill(-identity.groupId, 'SIGTERM'); } catch { return false; }
  for (let tick = 0; tick < 25; tick++) {
    await pause(100);
    try { process.kill(-identity.groupId, 0); } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return true; return false; }
    if (tick === 10) { try { process.kill(-identity.groupId, 'SIGKILL'); } catch { /* Verification below remains authoritative. */ } }
  }
  return false;
}

/** An absent/reused root is not, by itself, proof that all old descendants stopped. */
export async function stopOwnedProcessTree(identity: NativeProcessIdentity, driver: ProcessIdentityDriver = { read: readNativeProcessIdentity, terminate }): Promise<ProcessTerminationProof> {
  let stage = 'identity';
  const proof = (state: ProcessTerminationProof['state'], treeConfirmed = false): ProcessTerminationProof => ({ state, treeConfirmed, observedAt: new Date().toISOString(), ...(!treeConfirmed ? { reason: stage } : {}) });
  try {
    pidCheck(identity.pid);
    if (identity.pid === process.pid || identity.platform !== process.platform) return proof('unverified');
    const current = await driver.read(identity.pid);
    if (!current) return proof('absent');
    if (!sameNativeProcessIdentity(identity, current)) return proof(identity.birth !== current.birth ? 'different' : 'unverified');
    stage = 'termination';
    if (!await driver.terminate(identity)) return proof('unverified');
    stage = 'post-termination';
    const after = await driver.read(identity.pid);
    return !after || after.birth !== identity.birth ? proof('terminated', true) : proof('unverified');
  } catch (error) { if (error instanceof ProcessIdentityIssue) stage += ':' + error.reason; return proof('unverified'); }
}
