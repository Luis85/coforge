import type { WorkerRecord } from './store';
import { recoverVerificationRuntime } from '../verification/runtime';

/** A dead worker never grants authority to replay a test; resolve only its exact retained container. */
export async function recoverWorkerVerification(record: WorkerRecord, recover = recoverVerificationRuntime): Promise<boolean> {
  let proven = true;
  for (const runtime of record.verificationRuntime ?? []) {
    if (runtime.phase === 'terminal') {
      const evidence = record.snapshot.verification?.find(item => item.id === runtime.verificationId);
      if (evidence?.status === 'running' && evidence.runId === runtime.runId && evidence.attemptId === runtime.attemptId && evidence.projectId === runtime.projectId && evidence.sourceHash === runtime.sourceHash && evidence.commandId === runtime.commandId) {
        evidence.status = 'unknown'; evidence.finishedAt = new Date().toISOString();
        evidence.output = 'The original container stopped, but its result was not durably observed. No command was replayed.';
      }
      continue;
    }
    let outcome: 'terminal' | 'unknown' = 'unknown';
    try { outcome = await recover(runtime); } catch { /* The original ownership stays quarantined. */ }
    const at = new Date().toISOString();
    if (outcome === 'terminal') { runtime.phase = 'terminal'; runtime.terminalAt = at; }
    else proven = false;
    const evidence = record.snapshot.verification?.find(item => item.id === runtime.verificationId);
    if (evidence?.status === 'running') {
      evidence.status = outcome === 'terminal' ? 'interrupted' : 'unknown'; evidence.finishedAt = at;
      evidence.output = outcome === 'terminal' ? 'Original verification container stopped during recovery. No test was replayed.' : 'Original verification-container termination is unverified. No test was replayed.';
    }
  }
  return proven;
}
