import type { ProviderFailureInfo } from '../../../features/coforge/domain/provider-failure';

/** Ordinary CLI work follows terminal results and owned process state, not task-duration guesses. */
export const MANAGED_NATIVE_SESSION_HELP = 'CoForge waits for the agent’s completion or the CLI connection to end. Quiet periods do not end the task. Use Stop whenever you need to end the task. Code changes still need your review.';
export const MANAGED_MCP_SESSION_HELP = 'The connected MCP client supplies the result. This task stays available until the client submits its answer or the task is stopped. CoForge cannot observe the client’s own model session. Code changes still need your review.';

/** Captured catalogue text stays unchanged; new session UI points to the actual provider boundary. */
export function managedFailurePresentation(failure: ProviderFailureInfo | undefined, managed: boolean): { summary?: string; nextStep?: string } {
  if (!managed || !failure) return { summary: failure?.summary, nextStep: failure?.nextStep };
  if (failure.code === 'budget_limit' || failure.code === 'turn_limit' || failure.code === 'tool_limit') return {
    summary: 'The CLI or provider reported a usage or execution limit.',
    nextStep: 'Check the CLI and provider account settings. CoForge did not apply a task-duration, turn or spending cap to this managed session. Available work remains saved.',
  };
  if (failure.code === 'timeout') return {
    summary: 'The CLI or connection reported a timeout.',
    nextStep: 'Open Sessions to read the last reported activity. CoForge did not apply an elapsed task deadline to this managed session. Available work remains saved.',
  };
  return { summary: failure.summary, nextStep: failure.nextStep };
}
