import { appendAgentSessionEvent, type AgentSessionEvent } from '../domain/agent-session';
import type { StudioStore } from './studio-store';
import { polishingSaveOptions } from './polishing-save-options';

/** Best-effort private display evidence. Failed observation never changes execution authority or outcome. */
export async function recordAgentSessionEvent(store: StudioStore, jobId: string, event: AgentSessionEvent): Promise<void> {
  try {
    await store.transaction(state => {
      const job = state.jobs.find(item => item.id === jobId);
      if (!job) throw new Error('The observed attempt no longer exists.');
      job.sessionTrace = appendAgentSessionEvent(job.sessionTrace, event, new Date().toISOString());
    }, polishingSaveOptions(store.durableBuildJob(jobId), () => store.internalSnapshot()));
  } catch { /* Best-effort display persistence cannot gate execution. */ }
}
