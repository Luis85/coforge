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
          `${task.featureId} ${task.featureTitle} ${task.model ?? ""} ${task.stage}`
            .toLowerCase()
            .includes(store.search.toLowerCase()),
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );
  const summary = computed(() => costSummary(tasks.value));
  watch(
    () => [store.project, store.feature, store.search, store.source],
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
        displayCost:
          summary.reported + summary.manual > 0
            ? formatUsd(summary.nanos)
            : summary.simulations === group.length
              ? "Simulation"
              : "Unavailable",
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
        task.provider === "demo" ? "Simulation" : formatTokens(value);
      const provenance = (value: number | undefined) =>
        task.provider === "demo"
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
          cost.source === "simulation" ? "Simulation" : formatUsd(cost.nanos),
      };
    },
    date: (date: string) => new Date(date).toLocaleString(),
    refresh: () => {
      void run(async () => {
        await actions()?.refresh();
      });
    },
    preview: () => {
      store.example = true;
      connect();
    },
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
