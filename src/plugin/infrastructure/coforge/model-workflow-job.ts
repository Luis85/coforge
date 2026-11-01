import type { AgentJob } from '../../features/coforge/domain/types';

/** Operator observations and process capabilities are never supplied as model task context. */
export function modelWorkflowJob(job: AgentJob): AgentJob {
  const visible = { ...job };
  delete visible.verificationRuntime;
  delete visible.nativeProcess;
  delete visible.nativeRuntime;
  delete visible.sessionTrace;
  if (job.durable?.snapshot) {
    visible.durable = { ...job.durable, snapshot: { ...job.durable.snapshot } };
    delete visible.durable.snapshot?.sessionTrace;
  }
  return visible;
}
