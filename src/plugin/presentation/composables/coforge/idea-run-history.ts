import type { AgentJob } from '../../../features/coforge/domain/types';
import { STAGE_LABELS } from '../../../features/coforge/domain/types';
import { CODEX_CAPTURE_SCOPE_HELP, CODEX_PROVIDER_CONTEXT_HELP } from './codex-provider-context';
import { codingProfileDisplay } from './coding-profile-display';

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
  const nativeCodex = job.provider === 'codex' && !simulated;
  const model = job.model ?? (job.workflow?.step.kind === 'ai' ? job.workflow.step.model : undefined);
  const lines = [job.logs.join('\n') || 'No log entries.'];
  if (job.error) lines.push(`Error: ${job.error}`);
  return {
    id: job.id,
    durable: !!job.durable,
    runId: job.workflow?.runId,
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
    promptLabel: simulated ? 'Simulated input' : external ? 'Task context' : nativeCodex ? 'CoForge task prompt' : 'Captured prompt',
    instructionsLabel: nativeCodex ? 'CoForge instructions' : 'System instructions',
    providerContextHelp: nativeCodex ? CODEX_PROVIDER_CONTEXT_HELP : '',
    captureScopeHelp: nativeCodex ? CODEX_CAPTURE_SCOPE_HELP : 'Includes the initial prompt and recorded output. Intermediate tool turns are not retained.',
    outputLabel: simulated ? 'Simulated response' : external ? 'Submitted response' : 'LLM response',
    conversation,
    nativeTools: job.workflow?.step.nativeTools,
    codingProfile: job.workflow?.worktreeCoding ? codingProfileDisplay(job.workflow.worktreeCoding) : undefined,
    legacyCoding: !job.workflow?.worktreeCoding && !simulated && ['claude', 'codex', 'mcp'].includes(job.provider) && job.workflow?.step.output === 'codechange' && job.workflow.step.access === 'editworktree',
    verificationProfile: job.workflow?.verificationProfile,
    verification: job.verification ?? [],
    capturedLabel: conversation ? captureTime(conversation.capturedAt) : '',
    responseLabel: conversation?.responseCapturedAt ? captureTime(conversation.responseCapturedAt) : '',
    missingHistory: missingHistory(job),
    missingResponse: missingResponse(job),
  };
}

export type IdeaRunHistory = ReturnType<typeof ideaRunHistory>;
