import { computed, reactive } from 'vue';
import type { AgentJob, AgentStage, Idea } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { avatarStyle, categoryClass, contributorName, initials } from './format';
import { useStudioActions } from './use-studio-actions';
import { currentDesignSpecification } from './use-idea-design';

/** Voter ids the studio uses for the streamer across chat sources. */
const STREAMER_VOTERS = ['local:streamer', 'streamer', 'simulator:streamer'];
const AGENT_VERBS: Record<AgentStage, string> = { screen: 'screening', score: 'scoring', plan: 'planning', implement: 'building' };

export interface CardState { tone: 'flagged' | 'review' | 'agent' | 'done'; icon: string; label: string; spin: boolean }

/** The single next-state hint a card shows, in the prototype's priority order. */
export function cardState(idea: Idea, job: AgentJob | undefined): CardState | null {
  if (idea.status === 'flagged') return { tone: 'flagged', icon: 'shield-alert', label: 'Needs moderation', spin: false };
  if (job) return { tone: 'agent', icon: 'loader-circle', label: job.workflow
    ? `${job.workflow.step.name} ${job.status === 'queued' ? 'queued' : 'running'}`
    : job.status === 'queued' ? 'Queued' : `Agent ${AGENT_VERBS[job.stage]}`, spin: true };
  if (idea.lastError) return { tone: 'flagged', icon: 'flag', label: 'Run needs attention', spin: false };
  if (idea.status === 'planned') {
    const step = idea.workflowRun?.state === 'ready' ? idea.workflowRun.definition.steps[idea.workflowRun.cursor] : undefined;
    if (step?.kind === 'ai' && step.output === 'codechange' && currentDesignSpecification(idea))
      return { tone: 'agent', icon: 'file-check', label: 'Design complete · Ready to build', spin: false };
    return { tone: 'agent', icon: 'file-text', label: step ? `Ready · ${step.name}` : 'Plan ready', spin: false };
  }
  if (idea.status === 'review') return { tone: 'review', icon: 'circle-dot', label: 'Your review', spin: false };
  if (idea.status === 'shipped') return { tone: 'done', icon: 'check', label: 'Increment accepted', spin: false };
  if (idea.status === 'screened') return { tone: 'done', icon: 'check', label: 'Screened', spin: false };
  return null;
}

/** One idea card on the kanban: author, live agent state, RICE score and the streamer's vote. */
export function useIdeaCard(props: { idea: Idea }) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const author = computed(() => store.state?.contributors.find(person => person.id === props.idea.authorId));
  const authorName = computed(() => author.value?.name ?? contributorName([], props.idea.authorId));
  const job = computed(() => store.state?.jobs.find(item => item.ideaId === props.idea.id && (item.status === 'running' || item.status === 'queued')));
  const voted = computed(() => props.idea.voters.some(voter => STREAMER_VOTERS.includes(voter)));
  const flagged = computed(() => props.idea.status === 'flagged');
  const score = computed(() => props.idea.rice?.score);
  return reactive({
    idea: computed(() => props.idea),
    flagged,
    review: computed(() => props.idea.status === 'review'),
    categoryClass: computed(() => categoryClass(props.idea.category)),
    openLabel: computed(() => `Open ${props.idea.id}: ${props.idea.title}`),
    state: computed(() => cardState(props.idea, job.value)),
    authorName,
    authorInitials: computed(() => initials(authorName.value)),
    avatar: computed(() => avatarStyle(author.value?.color)),
    rice: computed(() => (score.value === undefined ? null : Number.isInteger(score.value) ? String(score.value) : score.value.toFixed(1))),
    riceTitle: computed(() => `RICE score: ${score.value ?? ''}`),
    voted,
    voteDisabled: computed(() => store.busy || voted.value || props.idea.status === 'rejected' || flagged.value),
    voteLabel: computed(() => `${voted.value ? 'Voted for' : 'Vote for'} ${props.idea.title}, ${props.idea.voters.length} votes`),
    voteTitle: computed(() => (voted.value ? 'You have voted for this idea' : 'Vote as streamer')),
    open: () => { store.select(props.idea.id); },
    vote: () => { void actions.vote(props.idea.id); },
  });
}
