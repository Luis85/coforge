import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as processTimeout, clearTimeout as clearProcessTimeout } from 'node:timers';
import { verificationEnvironment, verificationRoot } from './runtime';

export interface VerificationOutput { output: string; truncated: boolean; interrupted: boolean }
/** Drain output even after its evidence allowance is consumed; excess bytes never kill a healthy test. */
export function attachVerification(executable: string, endpoint: string, name: string, timeoutSeconds: number, signal?: AbortSignal, limit = 8192, onOutput?: (snapshot: VerificationOutput) => void): Promise<VerificationOutput> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['--config', join(verificationRoot(), 'client'), '--host', endpoint, 'container', 'start', '--attach', name], {
      cwd: verificationRoot(), env: verificationEnvironment(), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = []; let count = 0; let truncated = false; let interrupted = false;
    const append = (chunk: Buffer) => {
      const remaining = Math.max(0, limit - count); if (chunk.length > remaining) truncated = true;
      if (remaining) {
        const kept = chunk.subarray(0, remaining); chunks.push(Buffer.from(kept)); count += kept.length;
        try { onOutput?.({ output: Buffer.concat(chunks).toString('utf8'), truncated, interrupted }); } catch { /* Observation cannot interrupt a command. */ }
      }
    };
    const stop = () => { interrupted = true; child.kill(); };
    const timeout = processTimeout(stop, (timeoutSeconds + 20) * 1000);
    signal?.addEventListener('abort', stop, { once: true });
    const clean = () => { clearProcessTimeout(timeout); signal?.removeEventListener('abort', stop); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    child.once('error', () => { clean(); reject(new Error('The local verification client could not start.')); });
    child.once('close', () => { clean(); resolve({ output: Buffer.concat(chunks).toString('utf8'), truncated, interrupted }); });
  });
}
