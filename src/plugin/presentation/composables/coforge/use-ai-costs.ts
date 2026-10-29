import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  watch,
} from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useAICostStore } from "../../stores/coforge-ai-costs";
import { useTemporaryExample } from "./use-temporary-example";
import {
  costSummary,
  formatUsd,
  taskCost,
  type AICostTask,
} from "../../../features/coforge/domain/ai-costs";
import {
  formatTokens,
  tokenSummary,
} from "../../../features/coforge/domain/ai-usage";
import { attributionCoverage, attributionId, attributionName, costAttributionGroups, costGroupDisplay, COST_DIMENSIONS, type CostDimension } from '../../../features/coforge/domain/ai-cost-groups';
export function useAICosts() {
  const { host } = useCoforge();
  const store = useAICostStore();
  let stop = () => {};
  let closed = false;
  let amountInput: HTMLElement | null = null;
  let returnFocus: HTMLElement | null = null;
  const focusable = (value: unknown): value is HTMLElement =>
    Boolean(
      value &&
      typeof value === "object" &&
      typeof Reflect.get(value, "focus") === "function" &&
      Reflect.get(value, "nodeType") === 1,
    );
  const closeEditor = () => {
    store.editing = null;
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const actions = () =>
    store.example ? host.previewAiCosts?.() : host.aiCosts;
  async function run(work: () => Promise<void>) {
    if (store.busy) return;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
    } catch (error) {
      if (!closed)
        store.error =
          error instanceof Error
            ? error.message
            : "AI cost history is unavailable.";
    } finally {
      store.busy = false;
    }
  }
  function connect() {
    stop();
    const service = actions();
    if (!service) return;
    store.state = service.snapshot();
    stop = service.subscribe((state) => {
      if (!closed) store.state = state;
    });
  }
  onMounted(connect);
  onBeforeUnmount(() => {
    closed = true;
    stop();
  });
  const tasks = computed(() =>
    store.state.tasks
      .filter(
        (task) =>
          (!store.project || task.projectId === store.project) &&
          (!store.feature || task.featureId === store.feature) &&
          (!store.source || taskCost(task).source === store.source) &&
          (!store.agent || (attributionId(task, 'agent') ?? '__unattributed__') === store.agent) &&
          (!store.team || (attributionId(task, 'team') ?? '__unattributed__') === store.team) &&
          (!store.council || (attributionId(task, 'council') ?? '__unattributed__') === store.council) &&
          `${task.featureId} ${task.featureTitle} ${task.model ?? ""} ${task.stage} ${task.workflow?.stepName ?? ""} ${task.workflow?.stepId ?? ""} ${task.workflow?.runId ?? ""} ${task.workflow?.attemptId ?? ""} ${Object.values(task.attribution ?? {}).join(' ')}`
            .toLowerCase()
            .includes(store.search.toLowerCase()),
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );
  const summary = computed(() => costSummary(tasks.value));
  const attributionChoices = computed(() => ({ agent: costAttributionGroups(store.state.tasks, 'agent'), team: costAttributionGroups(store.state.tasks, 'team'), council: costAttributionGroups(store.state.tasks, 'council') }));
  const exitExample = () => {
    if (!store.example) return;
    stop();
    store.example = false;
    store.state = { tasks: [], loading: false, error: "" };
    store.editing = null;
    store.expected = "";
    store.amount = "";
    store.note = "";
    store.project = "";
    store.feature = "";
    store.search = "";
    store.source = "";
    store.agent = ''; store.team = ''; store.council = ''; store.dimension = 'agent';
    store.page = 0;
    store.error = "";
    store.notice = "";
    host.discardPreview?.("ai-costs");
  };
  const beginExample = useTemporaryExample("ai-costs", exitExample);
  watch(
    () => [store.project, store.feature, store.search, store.source, store.agent, store.team, store.council],
    () => {
      store.page = 0;
    },
  );
  const pages = computed(() => Math.max(1, Math.ceil(tasks.value.length / 50)));
  watch(pages, (value) => {
    store.page = Math.min(store.page, value - 1);
  });
  const features = computed(() => {
    const grouped = new Map<string, AICostTask[]>();
    for (const task of tasks.value) {
      const key = `${task.projectId}/${task.featureId}`;
      const group = grouped.get(key) ?? [];
      group.push(task);
      grouped.set(key, group);
    }
    return [...grouped.values()].map((group) => {
      const summary = costSummary(group);
      return {
        id: group[0]?.featureId ?? "",
        project: group[0]?.projectName ?? "",
        title: group[0]?.featureTitle ?? "",
        summary,
        tokens: tokenSummary(group),
        displayCost: costGroupDisplay(summary, group.length),
        count: group.length,
      };
    });
  });
  return reactive({
    store,
    tasks,
    pages,
    visibleTasks: computed(() =>
      tasks.value.slice(store.page * 50, (store.page + 1) * 50),
    ),
    summary,
    tokenTotals: computed(() => tokenSummary(tasks.value)),
    tokenCount: formatTokens,
    tokens: (task: AICostTask) => {
      const usage =
        task.provider !== "demo" && task.usageSource === "provider"
          ? task.usage
          : undefined;
      const count = (value: number | undefined) =>
        task.status === 'not-started' ? 'No provider contacted' : task.provider === "demo" ? "Simulation" : formatTokens(value);
      const provenance = (value: number | undefined) =>
        task.status === 'not-started' ? 'Not started' : task.provider === "demo"
          ? "Simulation"
          : value === undefined
            ? "Unavailable"
            : "Provider reported";
      return {
        input: count(usage?.inputTokens),
        output: count(usage?.outputTokens),
        cacheRead: count(usage?.cacheReadInputTokens),
        cacheWrite: count(usage?.cacheCreationInputTokens),
        inputSource: provenance(usage?.inputTokens),
        outputSource: provenance(usage?.outputTokens),
      };
    },
    features,
    dimensions: COST_DIMENSIONS,
    attributionCoverage: computed(() => attributionCoverage(tasks.value)),
    attributionGroups: computed(() => costAttributionGroups(tasks.value, store.dimension)),
    attributionOptions: (dimension: CostDimension) => attributionChoices.value[dimension],
    chooseDimension: (dimension: CostDimension) => { store.dimension = dimension; },
    chooseAttribution: (dimension: CostDimension, id: string) => { store[dimension] = id; },
    filterAttribution: (dimension: CostDimension, event: Event) => {
      const target = event.target;
      if (target && 'value' in target && typeof target.value === 'string') store[dimension] = target.value;
    },
    clearAttribution: () => { store.agent = ''; store.team = ''; store.council = ''; },
    attribution: (task: AICostTask) => ({ agent: attributionName(task, 'agent'), team: attributionName(task, 'team'), council: attributionName(task, 'council') }),
    status: (task: AICostTask) => task.status === 'not-started' ? 'Not started · no provider contacted' : task.status,
    money: formatUsd,
    available: computed(() => Boolean(actions())),
    canPreview: Boolean(host.previewAiCosts),
    projects: computed(() => [
      ...new Map(
        store.state.tasks.map((task) => [task.projectId, task.projectName]),
      ).entries(),
    ]),
    cost: (task: AICostTask) => {
      const cost = taskCost(task);
      return {
        ...cost,
        display:
          cost.source === 'not-started' ? 'No provider contacted' : cost.source === "simulation" ? "Simulation" : formatUsd(cost.nanos),
      };
    },
    date: (date: string) => new Date(date).toLocaleString(),
    refresh: () => {
      void run(async () => {
        await actions()?.refresh();
      });
    },
    preview: () => {
      if (host.aiCosts || store.busy) return;
      beginExample();
      store.example = true;
      connect();
    },
    exitExample,
    bindAmount: (value: unknown) => {
      amountInput = focusable(value) ? value : null;
    },
    edit: (task: AICostTask, event: Event) => {
      if (store.busy) return;
      returnFocus = focusable(event.currentTarget) ? event.currentTarget : null;
      store.editing = { ...task };
      store.expected = JSON.stringify(task);
      store.amount = task.manualUsd ?? "";
      store.note = task.manualNote ?? "";
      store.error = "";
      void nextTick(() => amountInput?.focus());
    },
    cancel: () => {
      closeEditor();
    },
    save: (event: Event) => {
      event.preventDefault();
      void run(async () => {
        if (!store.editing) return;
        await actions()?.setManual(
          store.editing.id,
          store.amount,
          store.note,
          store.expected,
        );
        closeEditor();
        store.notice = "Manual task cost saved.";
      });
    },
    clear: () => {
      void run(async () => {
        if (!store.editing) return;
        await actions()?.setManual(store.editing.id, null, "", store.expected);
        closeEditor();
        store.notice = "Manual fallback removed.";
      });
    },
  });
}
