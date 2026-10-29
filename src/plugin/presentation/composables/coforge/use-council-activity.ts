import { computed, reactive } from 'vue';
import { useCouncilModel } from './use-council';
import { decodeCouncilPlan } from '../../../features/coforge/application/council-execution';

export function useCouncilActivity() {
  const model = useCouncilModel();
  const runs = computed(() => (model.store.state?.runs ?? []).filter(run => run.projectId === model.projectId));
  const active = computed(() => runs.value.filter(run => ['running', 'publishing'].includes(run.state)).length);
  const queued = computed(() => runs.value.filter(run => run.state === 'queued').length);
  const attention = computed(() => runs.value.filter(run => ['attention', 'waiting-human'].includes(run.state)).length);
  const latest = computed(() => {
    const ordered = [...runs.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return ordered.find(run => ['running', 'publishing'].includes(run.state)) ?? ordered.find(run => ['attention', 'waiting-human', 'queued'].includes(run.state)) ?? ordered[0];
  });
  const current = computed(() => {
    const run = latest.value;
    if (!run) return 'No Council work admitted in this project yet.';
    const dispatching = run.attempts.filter(attempt => attempt.status === 'dispatching');
    let names = dispatching.map(attempt => run.invocations.find(item => item.id === attempt.invocationId)?.agentId ?? 'CoWorker');
    try { const plan = decodeCouncilPlan(run); names = dispatching.map(attempt => plan.invocations.find(item => item.id === attempt.invocationId)?.agent.name ?? 'CoWorker'); } catch { /* Durable evidence can outlive a readable definition. */ }
    const states = { queued: 'Queued', running: 'Collecting answers', publishing: 'Publishing answers', attention: 'Needs attention', 'waiting-human': 'Waiting for your decision', completed: 'Completed', cancelled: 'Cancelled' };
    const responding = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
    return `${run.limits?.simulation ? 'Simulation · ' : ''}${model.display.title(run)} · ${states[run.state]}${run.hasGaps ? ' with missing contributions' : ''} · ${run.cursor}/${run.invocations.length} steps completed or skipped${responding ? ` · Responding: ${responding}` : ''}`;
  });
  const lastActivity = computed(() => [...runs.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]);
  return reactive({ active, queued, attention, latest, current,
    lastActivity,
    updated: computed(() => lastActivity.value ? new Date(lastActivity.value.updatedAt).toLocaleString() : ''),
    execution: computed(() => !model.store.state?.executor ? 'Choose an execution desktop' : model.store.state.paused ? 'Execution paused' : model.store.state.preferences.pausedProjectIds?.includes(model.projectId) ? 'Project execution paused' : 'Execution resumed'),
    inspect: () => {
      model.store.projectFilter = model.projectId; model.store.stateFilter = ''; model.store.teamFilter = ''; model.store.targetFilter = ''; model.store.sourceFilter = '';
      model.store.inspectedRun = latest.value?.id ?? '';
      model.selectPage('monitor');
    },
  });
}
