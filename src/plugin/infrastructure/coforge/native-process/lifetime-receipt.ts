import { realpath } from 'node:fs/promises';
import { relative } from 'node:path';
import { tmpdir } from 'node:os';
import { boolean, number, oneOf, shape, text, timestamp } from '../../../features/coforge/domain/check';
import { nativeWorkflowLifetimeRefCheck, type NativeWorkflowLifetimeRef } from '../../../features/coforge/domain/native-workflow-lifetime';
import type { NativeProcessIdentity } from '../durable-worker/process-identity';
import { WorkerFiles } from '../durable-worker/files';

export const OWNED_PROCESS_REASONS = ['completed', 'cancelled', 'timeout', 'owner-lost', 'start-failed', 'transport-closed', 'unknown'] as const;
export type OwnedProcessReason = typeof OWNED_PROCESS_REASONS[number];
const receiptCheck = shape({ authority: nativeWorkflowLifetimeRefCheck, controllerPid: number({ integer: true, min: 1 }), controllerBirth: text({ min: 1, max: 160 }),
  rootPid: number({ integer: true, min: 0 }), rootExitCode: number({ integer: true }), startupError: number({ integer: true, min: 0 }), activeProcesses: number({ integer: true, min: -1 }),
  reason: oneOf(OWNED_PROCESS_REASONS), proof: oneOf(['controller', 'recovery'] as const), finishedAt: timestamp, quiescent: boolean }, { strict: true });
export type OwnedLifetimeReceipt = ReturnType<typeof receiptCheck>;
export async function ownedLifetimeFiles(input: NativeWorkflowLifetimeRef): Promise<WorkerFiles> {
  const lifetime = nativeWorkflowLifetimeRefCheck(input); const root = await realpath(tmpdir());
  if (!/^coforge-native-job-[a-zA-Z0-9_-]{6}$/u.test(relative(root, lifetime.directory))) throw new Error('Original native lifetime ownership changed.');
  const files = new WorkerFiles(lifetime.directory); await files.attach();
  if (JSON.stringify(nativeWorkflowLifetimeRefCheck(await files.read('owner.json', 8192))) !== JSON.stringify(lifetime)) throw new Error('Original native lifetime ownership changed.');
  return files;
}
/** Read original proof only. Absence, an old PID or an invalid receipt never establishes cessation. */
export async function inspectOwnedWorktreeLifetime(identity: NativeProcessIdentity, lifetime: NativeWorkflowLifetimeRef): Promise<OwnedLifetimeReceipt | undefined> {
  try {
    if (identity.platform !== 'win32' || lifetime.kind !== 'windows-job') return undefined;
    const files = await ownedLifetimeFiles(lifetime); const raw = await files.read('receipt.json', 8192); if (raw === undefined) return undefined;
    const result = receiptCheck(raw);
    if (JSON.stringify(result.authority) !== JSON.stringify(nativeWorkflowLifetimeRefCheck(lifetime)) || result.controllerPid !== identity.pid || result.controllerBirth !== identity.birth ||
        !result.quiescent || result.activeProcesses !== 0) return undefined;
    return result;
  } catch { return undefined; }
}
