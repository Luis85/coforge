import type { AgentJob } from '../../../features/coforge/domain/types';
import { STAGE_LABELS } from '../../../features/coforge/domain/types';

const captureTime = (value: string): string => new Date(value).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function missingHistory(job: AgentJob): string {
  if (job.status === 'queued') return 'No prompt has been sent yet.';
  if (job.status === 'running') return 'Waiting for captured input. No response is recorded yet.';
  return 'Chat history was not recorded for this run.';
}

function missingResponse(job: AgentJob): string {
  if (job.status === 'queued' || job.status === 'running') return 'No response recorded yet.';
  if (job.status === 'failed') return 'No response was recorded before this run failed.';
  if (job.status === 'cancelled') return 'No response was recorded before this run was cancelled.';
  return 'No response was recorded for this run.';
}

/** Read only captured attempt evidence; present-day settings cannot describe past dispatch. */
export function ideaRunHistory(job: AgentJob) {
  const conversation = job.conversation;
  const simulated = job.provider === 'demo' || conversation?.simulated === true;
  const external = job.provider === 'mcp';
  const model = job.model ?? (job.workflow?.step.kind === 'ai' ? job.workflow.step.model : undefined);
  const lines = [job.logs.join('\n') || 'No log entries.'];
  if (job.error) lines.push(`Error: ${job.error}`);
  return {
    id: job.id,
    label: job.workflow?.step.name ?? STAGE_LABELS[job.stage],
    provider: job.provider,
    model: simulated || external ? '' : model || 'Model not recorded',
    effort: simulated || external ? undefined : job.workflow?.step.effort,
    responsePrivacyLabel: job.provider === 'claude' ? 'Claude' : job.provider === 'codex' ? 'Codex' : '',
    status: job.status,
    startedAt: job.startedAt,
    startedLabel: captureTime(job.startedAt),
    log: lines.join('\n'),
    simulated,
    external,
    promptLabel: simulated ? 'Simulated input' : external ? 'Task context' : 'Captured prompt',
    outputLabel: simulated ? 'Simulated response' : external ? 'Submitted response' : 'LLM response',
    conversation,
    capturedLabel: conversation ? captureTime(conversation.capturedAt) : '',
    responseLabel: conversation?.responseCapturedAt ? captureTime(conversation.responseCapturedAt) : '',
    missingHistory: missingHistory(job),
    missingResponse: missingResponse(job),
  };
}

export type IdeaRunHistory = ReturnType<typeof ideaRunHistory>;
