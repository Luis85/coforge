import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import type { Idea } from '../../../features/coforge/domain/types';
import type { AICostState } from '../../../features/coforge/application/ai-cost-ports';
import { costSummary, formatUsd, taskCost, type AICostTask } from '../../../features/coforge/domain/ai-costs';
import { formatTokens, tokenSummary } from '../../../features/coforge/domain/ai-usage';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';

const empty = (): AICostState => ({ tasks: [], loading: false, error: '' });
const providerNames = { claude: 'Claude Code', codex: 'Codex', herdr: 'Herdr', mcp: 'External MCP client', demo: 'Simulation' };
const sourceNames = { reported: 'Provider reported', manual: 'Manual fallback', unavailable: 'Unavailable', simulation: 'Simulation', 'not-started': 'No provider contacted' };

/** A request-local reader of the retained ledger; never changes the dashboard's filters or edits costs. */
export function useIdeaAICosts(props: { idea: Idea }) {
  const { host } = useCoforge(); const store = useStudioStore();
  const state = ref<AICostState>(empty()); const problem = ref(false); const refreshing = ref(false); const limit = ref(50);
  let stop = () => {}; let generation = 0;
  const scoped = computed(() => store.state?.activeProjectId === ideaProjectId(props.idea));
  watch(() => [props.idea.id, ideaProjectId(props.idea), store.state?.activeProjectId], () => {
    stop(); stop = () => {}; const token = ++generation; state.value = empty(); problem.value = false; refreshing.value = false; limit.value = 50;
    if (!scoped.value) { if (store.selected === props.idea.id) store.select(null); return; }
    if (!host.aiCosts) return;
    try {
      state.value = host.aiCosts.snapshot();
      stop = host.aiCosts.subscribe(value => { if (token === generation && scoped.value) state.value = value; });
    } catch { problem.value = true; }
  }, { immediate: true, flush: 'sync' });
  onBeforeUnmount(() => { generation++; stop(); stop = () => {}; });
  const tasks = computed(() => scoped.value ? state.value.tasks.filter(task => task.projectId === ideaProjectId(props.idea) && task.featureId === props.idea.id)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt)) : []);
  const summary = computed(() => costSummary(tasks.value)); const usage = computed(() => tokenSummary(tasks.value));
  function row(task: AICostTask) {
    const cost = taskCost(task); const tokens = tokenSummary([task]);
    const token = (value: bigint | undefined) => task.status === 'not-started' ? 'No provider contacted' : task.provider === 'demo' ? 'Simulation' : formatTokens(value);
    return { ...task, providerLabel: providerNames[task.provider], modelLabel: task.provider === 'demo' ? 'No model call' : task.model ?? 'Model not recorded',
      stepLabel: task.workflow?.stepName ?? task.stage, runLabel: task.workflow?.runId ?? 'Not recorded', attemptLabel: task.workflow?.attemptId ?? task.id,
      cost: cost.nanos === undefined ? sourceNames[cost.source] : formatUsd(cost.nanos), source: sourceNames[cost.source],
      input: token(tokens.inputTokens), output: token(tokens.outputTokens), cacheRead: token(tokens.cacheReadInputTokens), cacheWrite: token(tokens.cacheCreationInputTokens),
      manual: cost.source === 'manual' };
  }
  async function refresh() {
    if (!host.aiCosts || refreshing.value || !scoped.value) return;
    const token = generation; refreshing.value = true; problem.value = false;
    try { await host.aiCosts.refresh(); }
    catch { if (token === generation) problem.value = true; }
    finally { if (token === generation) refreshing.value = false; }
  }
  return reactive({ summary, usage, refreshing,
    available: computed(() => !!host.aiCosts), loading: computed(() => state.value.loading), failed: computed(() => problem.value || !!state.value.error),
    count: computed(() => tasks.value.length), rows: computed(() => tasks.value.slice(0, limit.value).map(row)),
    knownCount: computed(() => summary.value.reported + summary.value.manual),
    knownSubtotal: computed(() => summary.value.reported + summary.value.manual ? formatUsd(summary.value.nanos) : 'Unavailable'),
    more: computed(() => tasks.value.length > limit.value), showMore: () => { limit.value += 50; }, refresh: () => { void refresh(); },
    date: (value: string) => new Date(value).toLocaleString(),
  });
}
