import { useCouncilIdeaDraft } from "./use-council-idea-draft";
import { useCouncilSelection } from './council-selection';
import { computed, reactive, ref, watch } from "vue";
import type { CouncilActions } from "../../../features/coforge/application/council-ports";
import type { CouncilTarget } from "../../../features/coforge/application/council-execution";
import type { CouncilTaskRecord } from "../../../features/coforge/application/council-tasks";
import type { useCouncilStore } from "../../stores/coforge-council";
import {
  councilTaskHistory,
  type CouncilTaskHistoryRow,
} from "./council-task-history";

export function useCouncilAsk(host: {
  store: ReturnType<typeof useCouncilStore>;
  service(): CouncilActions;
  available(): boolean;
  current(service: CouncilActions): boolean;
  target(): CouncilTarget;
  projectId(): string;
  closed(): boolean;
  refresh(): Promise<void>;
  run(work: () => Promise<void>): Promise<void>;
}) {
  const { store } = host;
  const linkedDraft = useCouncilIdeaDraft();
  const search = ref("");
  const limit = ref(50);
  const available = computed(() => {
    void store.example;
    return host.available();
  });
  const history = computed(() => councilTaskHistory(store.state, store.tasks).filter(item => store.taskHistoryScope === 'all' || Boolean(host.projectId() && item.projectId === host.projectId())));
  const selection = useCouncilSelection(() => store.catalogue, host.projectId, () => store.taskCouncil);
  const councils = computed(() => selection.councils.map(definition => ({ definition })));
  function composerTarget(): CouncilTarget {
    const council = selection.selected;
    if (!council || !selection.ready) throw new Error(selection.issue || 'Select an available Council for this question.');
    return {
      kind: "council",
      id: council.id,
      teamId: council.teamId,
    };
  }
  const councilSelected = computed(() => {
    try {
      return composerTarget().kind === "council";
    } catch {
      return false;
    }
  });
  const filtered = computed(() => {
    const needle = search.value.trim().toLowerCase();
    return history.value.filter((item) =>
      `${item.title} ${item.source} ${item.projectId} ${item.status}`
        .toLowerCase()
        .includes(needle),
    );
  });
  watch([search, () => store.taskHistoryScope], () => {
    limit.value = 50;
  });
  watch(
    () => [
      store.taskTitle,
      store.taskQuestion,
      store.taskTeam,
      store.taskCouncil,
      store.taskLinkedIdea,
    ],
    () => {
      store.preview = null;
      store.taskSource = "";
      store.taskReviewDraftKey = "";
      if (store.taskConfirmedSavedDraftKey === store.taskDraftKey) {
        store.taskDraftKey = crypto.randomUUID();
        store.taskConfirmedSavedDraftKey = "";
      }
      if (!store.taskProjectId && (store.taskTitle || store.taskQuestion))
        store.taskProjectId = host.projectId();
    },
    { flush: "sync" },
  );
  watch(host.projectId, () => {
    if (!store.taskTitle && !store.taskQuestion) {
      store.taskTeam = "";
      store.taskCouncil = "";
      store.taskProjectId = host.projectId();
    }
  });
  const draftIdentity = () =>
    JSON.stringify([
      host.projectId(),
      store.taskTeam,
      store.taskCouncil,
      store.taskTitle,
      store.taskQuestion,
      store.taskDraftKey,
      store.taskLinkedIdea,
    ]);
  async function previewTask(task: CouncilTaskRecord, service: CouncilActions) {
    store.team = task.target.teamId;
    store.target = task.target.id;
    store.source = task.path;
    store.taskSource = task.path;
    const identity = draftIdentity();
    const preview = await service.preflight(task.target, task.path);
    if (
      !host.closed() &&
      host.current(service) &&
      identity === draftIdentity() &&
      store.team === task.target.teamId &&
      store.target === task.target.id &&
      store.source === task.path
    )
      store.preview = preview;
  }
  return reactive({
    available,
    linkedDraft,
    selection,
    executionNeeded: computed(() => !store.state?.executor || Boolean(store.taskSource) || Boolean(store.state?.paused && store.state.runs.some(run => run.projectId === host.projectId() && ['queued', 'running', 'publishing'].includes(run.state)))),
    councils,
    simulationPreview: computed(
      () =>
        store.preview?.plan.invocations.some(
          (item) => item.agent.provider === "demo",
        ) ?? false,
    ),
    search,
    history: computed(() => filtered.value.slice(0, limit.value)),
    historyCount: computed(() => history.value.length),
    matchingCount: computed(() => filtered.value.length),
    more: computed(() => filtered.value.length > limit.value),
    canSave: computed(
      () =>
        available.value &&
        store.catalogueLoaded &&
        councilSelected.value &&
        !store.busy &&
        (!store.taskProjectId || store.taskProjectId === host.projectId()) &&
        Boolean(
          host.projectId() &&
          store.taskCouncil &&
          store.taskTitle.trim() &&
          store.taskQuestion.trim(),
        ),
    ),
    save: () =>
      host.run(async () => {
        const identity = draftIdentity();
        const target = composerTarget();
        const service = host.service();
        if (store.taskProjectId && store.taskProjectId !== host.projectId())
          throw new Error(
            `This draft belongs to ${store.taskProjectId}. Select that project or start a new task; your draft is kept.`,
          );
        if (target.kind !== "council")
          throw new Error("Choose a configured council for this question.");
        const saved = await service.createTask({
          projectId: host.projectId(),
          target,
          title: store.taskTitle,
          question: store.taskQuestion,
          idempotencyKey: store.taskDraftKey,
          ...(store.taskLinkedIdea
            ? { linkedIdea: { ...store.taskLinkedIdea } }
            : {}),
        });
        if (host.closed() || !host.current(service)) return;
        store.tasks = [
          ...store.tasks.filter((task) => task.sourceId !== saved.sourceId),
          saved,
        ];
        if (identity !== draftIdentity()) {
          store.notice = `Task saved for ${saved.projectId}. Your newer draft is kept.`;
          return;
        }
        store.taskConfirmedSavedDraftKey = store.taskDraftKey;
        store.taskReviewDraftKey = store.taskDraftKey;
        store.destination = `CoForge/Tests/${saved.sourceId}-simulation.md`;
        store.source = saved.path;
        store.taskSource = saved.path;
        await host.refresh();
        if (
          host.closed() ||
          !host.current(service) ||
          identity !== draftIdentity()
        )
          return;
        await previewTask(saved, service);
        store.notice =
          "Task saved and reviewed. No run has been submitted and no provider was contacted.";
      }),
    review: (task: CouncilTaskRecord) =>
      host.run(async () => {
        if (task.projectId !== host.projectId())
          throw new Error(
            `Select project ${task.projectId} before reviewing this saved task. Your current draft is kept.`,
          );
        store.taskReviewDraftKey = "";
        store.team = task.target.teamId;
        store.target = task.target.id;
        await previewTask(task, host.service());
        store.notice = `Reviewing saved task “${task.title}”. Your new-task draft is kept.`;
      }),
    inspect: (item: CouncilTaskHistoryRow) => {
      if (!item.runId) return;
      store.projectFilter = item.projectId;
      store.stateFilter = "";
      store.teamFilter = "";
      store.targetFilter = "";
      store.sourceFilter = "";
      store.inspectedRun = item.runId;
      store.tab = "monitor";
    },
    newTask: () => {
      if (store.busy) return;
      store.taskConfirmedSavedDraftKey = "";
      store.taskReviewDraftKey = "";
      store.taskLinkedIdea = null;
      store.pendingIdeaAssessment = null;
      store.taskTitle = "";
      store.taskQuestion = "";
      store.taskDraftKey = crypto.randomUUID();
      store.taskProjectId = host.projectId();
      store.taskSource = "";
      store.source = "";
      store.preview = null;
      store.notice = "";
    },
    showMore: () => {
      limit.value += 50;
    },
    when: (at: string) =>
      at ? new Date(at).toLocaleString() : "Latest observation",
  });
}
