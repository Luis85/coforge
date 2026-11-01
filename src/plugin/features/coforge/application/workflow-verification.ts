import type { AgentJob } from '../domain/types';
import { workflowVerificationRecordCheck, workflowVerificationRuntimeRecordCheck, type WorkflowVerificationRecord, type WorkflowVerificationRuntimeRecord } from '../domain/workflow-verification';
import type { StudioStore } from './studio-store';
import { polishingSaveOptions } from './polishing-save-options';

function assertIdentity(job: AgentJob | undefined, record: Pick<WorkflowVerificationRecord, 'runId' | 'attemptId' | 'projectId' | 'commandId'>): asserts job is AgentJob {
  if (!job?.workflow || !['claude', 'codex'].includes(job.provider) || job.workflow.runId !== record.runId || job.workflow.attemptId !== record.attemptId || job.projectId !== record.projectId
    || !job.workflow.verificationProfile?.commands.some(command => command.id === record.commandId)) throw new Error('Verification evidence does not belong to this admitted native attempt.');
}

/** The host awaits durable evidence before container creation or execution. Model prose never enters here. */
export async function recordWorkflowVerification(store: StudioStore, jobId: string, input: WorkflowVerificationRecord): Promise<void> {
  const record = workflowVerificationRecordCheck(input);
  await store.transaction(state => {
    const job = state.jobs.find(item => item.id === jobId);
    assertIdentity(job, record);
    if (record.workspaceId !== job.workflow!.workspaceId) throw new Error('Verification evidence belongs to a different workspace.');
    const command = job.workflow!.verificationProfile!.commands.find(command => command.id === record.commandId)!;
    if (record.imageId !== job.workflow!.verificationProfile!.imageId || record.label !== command.label || record.executable !== command.executable || JSON.stringify(record.args) !== JSON.stringify(command.args)) throw new Error('Verification evidence differs from its captured command.');
    const records = job.verification ??= [];
    const index = records.findIndex(item => item.id === record.id);
    const previous = records[index];
    if (previous) {
      const immutable = (item: WorkflowVerificationRecord) => JSON.stringify({ ...item, status: undefined, finishedAt: undefined, exitCode: undefined, output: undefined, truncated: undefined });
      if (immutable(previous) !== immutable(record) || previous.status !== 'running' && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error('Completed verification evidence cannot be overwritten.');
      records[index] = record;
    } else {
      if (record.status !== 'running' || records.length >= job.workflow!.verificationProfile!.maxRuns) throw new Error('Verification must reserve a running record within its captured run limit.');
      records.push(record);
    }
  }, polishingSaveOptions(store.durableBuildJob(jobId), () => store.internalSnapshot()));
}

export async function recordWorkflowVerificationRuntime(store: StudioStore, jobId: string, input: WorkflowVerificationRuntimeRecord): Promise<void> {
  const record = workflowVerificationRuntimeRecordCheck(input);
  await store.transaction(state => {
    const job = state.jobs.find(item => item.id === jobId);
    assertIdentity(job, record);
    if (record.dockerBin !== job.workflow!.verificationProfile!.dockerBin || record.imageId !== job.workflow!.verificationProfile!.imageId) throw new Error('Container ownership differs from its captured Docker profile.');
    const records = job.verificationRuntime ??= [];
    const index = records.findIndex(item => item.verificationId === record.verificationId);
    const previous = records[index];
    const immutable = (item: WorkflowVerificationRuntimeRecord) => JSON.stringify({ ...item, phase: undefined, terminalAt: undefined });
    if (previous && (immutable(previous) !== immutable(record) || ['prepared', 'created', 'started', 'terminal'].indexOf(record.phase) < ['prepared', 'created', 'started', 'terminal'].indexOf(previous.phase))) throw new Error('Container ownership evidence cannot regress or change identity.');
    if (index >= 0) records[index] = record;
    else { if (record.phase !== 'prepared' || records.length >= 32) throw new Error('Container ownership must be prepared before execution.'); records.push(record); }
  }, polishingSaveOptions(store.durableBuildJob(jobId), () => store.internalSnapshot()));
}
