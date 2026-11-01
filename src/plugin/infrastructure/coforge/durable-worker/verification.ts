import type { DurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { workflowVerificationRecordCheck, workflowVerificationRuntimeRecordCheck, type WorkflowVerificationRecord, type WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';
import type { WorkerStore } from './store';

/** All records originate in the host broker; model output cannot call these journal hooks. */
export function workerVerificationHooks(store: WorkerStore, ref: DurableBuildRef) {
  const profile = store.get(ref).request.input.workflow.verificationProfile;
  const identity = (record: Pick<WorkflowVerificationRecord, 'runId' | 'attemptId' | 'projectId' | 'commandId'>) => {
    const request = store.get(ref).request;
    if (!profile?.enabled || request.runId !== record.runId || request.attemptId !== record.attemptId || request.projectId !== record.projectId)
      throw new Error('Verification does not belong to this authorized worker attempt.');
    const command = profile.commands.find(item => item.id === record.commandId);
    if (!command) throw new Error('The verification command was not captured for this attempt.');
    return command;
  };
  return {
    verification: async (input: WorkflowVerificationRecord) => {
      const record = workflowVerificationRecordCheck(input); const command = identity(record);
      if (record.imageId !== profile!.imageId || record.executable !== command.executable || record.label !== command.label || JSON.stringify(record.args) !== JSON.stringify(command.args))
        throw new Error('The verification command identity changed.');
      await store.update(ref, next => {
        const records = next.snapshot.verification ??= [];
        const index = records.findIndex(item => item.id === record.id); const previous = records[index];
        const immutable = (item: WorkflowVerificationRecord) => JSON.stringify({ ...item, status: undefined, finishedAt: undefined, exitCode: undefined, output: undefined, truncated: undefined });
        if (previous) {
          if (immutable(previous) !== immutable(record) || previous.status !== 'running' && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error('Verification evidence cannot be overwritten.');
          records[index] = record;
        } else {
          if (record.status !== 'running' || records.length >= profile!.maxRuns) throw new Error('Verification requires a reservation within the captured limit.');
          records.push(record);
        }
      });
    },
    verificationRuntime: async (input: WorkflowVerificationRuntimeRecord) => {
      const record = workflowVerificationRuntimeRecordCheck(input); identity(record);
      if (record.imageId !== profile!.imageId || record.dockerBin !== profile!.dockerBin) throw new Error('The captured verification runtime changed.');
      await store.update(ref, next => {
        const evidence = next.snapshot.verification?.find(item => item.id === record.verificationId);
        if (!evidence || evidence.sourceHash !== record.sourceHash || evidence.commandId !== record.commandId) throw new Error('Container ownership requires the original verification reservation.');
        const records = next.verificationRuntime ??= [];
        const index = records.findIndex(item => item.verificationId === record.verificationId); const previous = records[index];
        const immutable = (item: WorkflowVerificationRuntimeRecord) => JSON.stringify({ ...item, phase: undefined, terminalAt: undefined });
        const phases = ['prepared', 'created', 'started', 'terminal'];
        if (previous && (immutable(previous) !== immutable(record) || phases.indexOf(record.phase) < phases.indexOf(previous.phase))) throw new Error('Container ownership cannot change or regress.');
        if (previous) records[index] = record;
        else { if (record.phase !== 'prepared' || records.length >= profile!.maxRuns) throw new Error('Container ownership must be reserved before creation.'); records.push(record); }
      });
    },
  };
}
