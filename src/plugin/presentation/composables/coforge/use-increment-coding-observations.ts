import { computed, reactive } from 'vue';
import type { Idea } from '../../../features/coforge/domain/types';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { useStudioStore } from '../../stores/coforge-studio';
import { nativeSessionProvider, observedSessionChildren, sessionEventView, sessionObservation } from './agent-session-display';
import { codingProfileDisplay, MCP_COMMAND_EVIDENCE_HELP, PROVIDER_TOOL_EVIDENCE_HELP } from './coding-profile-display';

export interface ProducingCodingAttempt { runId: string; attemptId: string; historical: boolean }
/** Consume the review's validated producing attempt; no stdout parsing creates a test verdict. */
export function useIncrementCodingObservations(props: { idea: Idea; source?: ProducingCodingAttempt }) {
  const store = useStudioStore();
  const model = computed(() => {
    if (!store.state || store.state.activeProjectId !== ideaProjectId(props.idea) || props.idea.increment?.simulated) return undefined;
    const source = props.source;
    if (!source) return undefined;
    const jobs = store.state.jobs.filter(job => job.ideaId === props.idea.id && job.projectId === ideaProjectId(props.idea)
      && job.workflow?.runId === source.runId && job.workflow.attemptId === source.attemptId && job.workflow.worktreeCoding);
    if (jobs.length !== 1) return undefined;
    const job = jobs[0]!; const profile = job.workflow?.worktreeCoding;
    if (!profile) return undefined;
    if (profile.profile === 'native-worktree-v1' ? !nativeSessionProvider(job) : job.provider !== 'mcp') return undefined;
    const trace = sessionObservation(store.state, job).trace;
    const native = nativeSessionProvider(job);
    const children = native ? observedSessionChildren(trace) : [];
    return { ...source, profile: codingProfileDisplay(profile),
      title: native ? 'Provider tool observations' : 'Host-observed MCP commands',
      help: native ? PROVIDER_TOOL_EVIDENCE_HELP : MCP_COMMAND_EVIDENCE_HELP,
      truncated: trace?.truncated === true,
      entries: (trace?.events ?? []).filter(event => event.kind === 'tool' || event.kind === 'notice').map(event => {
        const view = sessionEventView(event, children); return { ...view, actor: native ? view.actor : 'Host MCP observation' };
      }),
    };
  });
  return reactive({ model });
}
