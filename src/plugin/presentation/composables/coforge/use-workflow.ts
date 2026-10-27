import { computed, reactive, ref } from 'vue';
import type { AgentJob, AgentStage, Settings } from '../../../features/coforge/domain/types';
import { STAGE_LABELS, STAGES } from '../../../features/coforge/domain/types';
import { isActiveJob } from '../../../features/coforge/domain/workflow';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';

interface StageCopy { icon: string; title: string; description: string; input: string; output: string }

const STAGE_COPY: Record<AgentStage, StageCopy> = {
  screen: {
    icon: 'shield-check', title: 'Screen the request', input: 'New idea', output: 'Screened or flagged',
    description: 'Check untrusted chat for prompt injection and hold suspicious requests for moderation.',
  },
  score: {
    icon: 'sparkles', title: 'Find the value', input: 'Screened idea', output: 'Ranked idea',
    description: 'Review product fit and estimate RICE with a written rationale for every score.',
  },
  plan: {
    icon: 'list-checks', title: 'Make a plan', input: 'Ranked idea', output: 'Saved plan',
    description: 'Pick a high-priority idea and save implementation steps, risks, and acceptance criteria.',
  },
  implement: {
    icon: 'code', title: 'Build the increment', input: 'Saved plan', output: 'Ready for review',
    description: 'Execute the saved plan and collect changed files and a diff for the streamer.',
  },
};
const HISTORY_PREVIEW = 8;
const FAILURE = 'The workflow could not be updated.';
const SETTINGS_LOCATION = 'Studio settings → Agent workspace';

const historyRow = (job: AgentJob) => ({
  id: job.id, ideaId: job.ideaId, status: job.status, stageLabel: STAGE_LABELS[job.stage],
  providerLabel: job.provider === 'demo' ? 'Simulation' : 'Claude Code',
  time: new Date(job.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  canCancel: isActiveJob(job),
  costText: job.costUsd === undefined ? '' : `Reported cost: $${job.costUsd.toFixed(4)}`,
  log: `${job.logs.join('\n') || 'No log entries.'}${job.error ? `\nError: ${job.error}` : ''}`,
});

/** View model of the agent workflow page: stage toggles, the workbench, the queue rules and the run history. */
export function useWorkflow() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const error = ref('');
  const expanded = ref(false);
  const settings = computed<Settings | undefined>(() => store.state?.settings);
  const paused = computed(() => settings.value?.paused ?? true);
  const isDemo = computed(() => settings.value?.provider !== 'claude');
  const running = computed(() => store.projectJobs.find(job => job.status === 'running'));
  const queuedCount = computed(() => store.projectJobs.filter(job => job.status === 'queued').length);
  const enabledCount = computed(() => STAGES.filter(stage => settings.value?.automation[stage]).length);
  const implementationBlocked = computed(() => !isDemo.value && !store.state?.runtime.allowImplementation);
  const rows = computed(() => [...store.projectJobs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(historyRow));

  /** Runs one workflow request; a failure is already toasted by the store and is also kept inline. */
  function perform(work: () => Promise<boolean>): void {
    error.value = '';
    void work().then(done => { if (!done) error.value = FAILURE; });
  }

  return reactive({
    store, error, expanded, paused, isDemo, enabledCount,
    blockedText: `Implementation permission is required for this project. Enable it in ${SETTINGS_LOCATION}.`,
    canRunNext: computed(() => !store.busy && !running.value && queuedCount.value === 0),
    summaryLabel: computed(() => paused.value ? 'Automation paused' : enabledCount.value ? 'Automation is running' : 'Manual workflow'),
    intervalSeconds: computed(() => settings.value?.intervalSeconds ?? 0),
    providerIcon: computed(() => isDemo.value ? 'flask-conical' : 'bot'),
    providerLabel: computed(() => isDemo.value ? 'Simulated agents' : 'Claude Code'),
    providerTitle: computed(() => {
      const runtime = store.state?.runtime;
      if (isDemo.value || !runtime) return undefined;
      return `Claude Code CLI ${runtime.cliAvailable ? 'available' : 'not detected'} · project folder: ${runtime.projectPath ?? 'not set'}`;
    }),
    stages: computed(() => STAGES.map((stage, index) => ({
      id: stage, ...STAGE_COPY[stage],
      isActive: running.value?.stage === stage,
      automated: Boolean(settings.value?.automation[stage]),
      blocked: stage === 'implement' && implementationBlocked.value,
      last: index === STAGES.length - 1,
      toggleLabel: `Automatically ${stage === 'implement' ? 'implement plans' : `${stage} ideas`}`,
    }))),
    active: computed(() => {
      const job = running.value;
      if (!job) return null;
      return {
        id: job.id, ideaId: job.ideaId, label: `${STAGE_LABELS[job.stage]} in progress`,
        title: store.state?.ideas.find(idea => idea.id === job.ideaId)?.title ?? 'Community idea',
        lastLog: job.logs[job.logs.length - 1] ?? 'Starting the agent…',
      };
    }),
    idleText: computed(() => paused.value
      ? 'Resume automation or dispatch the next idea yourself.'
      : 'The workflow will pick up eligible ideas as they arrive.'),
    thresholdLabel: computed(() => {
      const votes = settings.value?.minVotes ?? 0;
      return `Planning threshold: ${votes} ${votes === 1 ? 'vote' : 'votes'}`;
    }),
    runCount: computed(() => rows.value.length),
    visibleRuns: computed(() => expanded.value ? rows.value : rows.value.slice(0, HISTORY_PREVIEW)),
    hasMoreRuns: computed(() => rows.value.length > HISTORY_PREVIEW),
    moreLabel: computed(() => expanded.value ? 'Show recent runs' : `Show all ${rows.value.length} runs`),
    runNext: () => perform(() => actions.runNext()),
    togglePause: () => perform(() => actions.changeSettings({ paused: !paused.value })),
    toggleStage: (stage: AgentStage) => {
      const current = settings.value?.automation;
      if (!current) return;
      perform(() => actions.changeSettings({ automation: { ...current, [stage]: !current[stage] } }));
    },
    cancel: (jobId: string) => perform(() => actions.cancelJob(jobId)),
    openIdea: (ideaId: string) => store.select(ideaId),
    editPrompt: (stage: AgentStage) => { store.promptStage = stage; store.navigate('settings'); },
    toggleExpanded: () => { expanded.value = !expanded.value; },
  });
}
export type WorkflowModel = ReturnType<typeof useWorkflow>;
