import { nativeWorkflowPrivateRuntimeCheck, nativeWorkflowProcessRecordCheck, type NativeWorkflowPrivateRuntime, type NativeWorkflowProcessRecord } from '../../../features/coforge/domain/native-workflow-process';
import type { DurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { sameNativeProcessIdentity } from './process-identity';
import type { WorkerStore, WorkerRecord } from './store';
import { purgeCodexPrivateRuntime } from '../codex-private-runtime';

/** A private auth/session receipt exists before opaque native credentials are copied. */
export function workerNativeRuntimeHooks(store: WorkerStore, ref: DurableBuildRef) {
  const identity = (record: { runId: string; attemptId: string; projectId: string }) => {
    const request = store.get(ref).request;
    if (request.input.workflow.step.provider !== 'codex' || !request.input.workflow.step.nativeTools || request.runId !== record.runId || request.attemptId !== record.attemptId || request.projectId !== record.projectId) throw new Error('Private native ownership does not match the admitted worker.');
  };
  return {
    nativeRuntime: async (input: NativeWorkflowPrivateRuntime | undefined) => {
      const runtime = input ? nativeWorkflowPrivateRuntimeCheck(input) : undefined;
      if (runtime) identity(runtime);
      await store.update(ref, next => {
        if (runtime) {
          if (next.provider || next.nativeRuntime && JSON.stringify(next.nativeRuntime) !== JSON.stringify(runtime)) throw new Error('Original private native preparation cannot change.');
          next.nativeRuntime = runtime;
        } else {
          if (next.provider && !next.provider.contractCompletedAt && !next.provider.treeTerminatedAt) throw new Error('The original provider must be quiescent before private native cleanup.');
          delete next.nativeRuntime;
        }
      });
    },
    nativeProcess: async (input: NativeWorkflowProcessRecord) => {
      const record = nativeWorkflowProcessRecordCheck(input); identity(record);
      await store.update(ref, next => {
        if (!next.provider?.identity || !sameNativeProcessIdentity(next.provider.identity, record.identity)) throw new Error('Native completion does not belong to the original OS provider.');
        if (record.privateRuntime && JSON.stringify(record.privateRuntime) !== JSON.stringify(next.nativeRuntime)) throw new Error('Private native completion ownership changed.');
        if (record.phase === 'terminated') {
          // Only the trusted runner emits this after parsing the final result and closing the broker.
          // Cancellation emits it before finalizing and carries the independent owned-tree proof.
          if (next.snapshot.phase === 'finalizing') next.provider.contractCompletedAt = record.observedAt;
          else next.provider.treeTerminatedAt = record.observedAt;
        }
        if (record.phase === 'unknown') { delete next.provider.contractCompletedAt; delete next.provider.treeTerminatedAt; }
      });
    },
  };
}

/** Cleanup never starts a provider; absence of a committed provider also means task input was never sent. */
export async function recoverWorkerNativeRuntime(record: WorkerRecord, purge = purgeCodexPrivateRuntime): Promise<boolean> {
  if (!record.nativeRuntime) return true;
  if (record.provider && !record.provider.contractCompletedAt && !record.provider.treeTerminatedAt) return false;
  try { await purge(record.nativeRuntime); delete record.nativeRuntime; return true; } catch { return false; }
}
