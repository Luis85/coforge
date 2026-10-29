import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  watch,
  provide,
  inject,
  type InjectionKey,
} from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useCouncilStore } from "../../stores/coforge-council";
import { consumeCouncilEntry } from './use-council-entry';
import { useStudioStore } from "../../stores/coforge-studio";
import { type CouncilPage } from "../../stores/studio-pages";
import type { CouncilTarget } from "../../../features/coforge/application/council-execution";
import { councilInboxActions } from "./council-inbox-actions";
import { useTemporaryExample } from "./use-temporary-example";
import { resetCouncilExample } from "./council-example-reset";
import { councilArtifactLabel } from "../../../features/coforge/application/council-execution";
import { councilSubmissionActions } from "./council-submission-actions";
import { isWorkflowV2Run } from "../../../features/coforge/application/workflow-v2-execution";
import type {
  ExecutionRun,
  ExecutionArtifact,
} from "../../../features/coforge/domain/execution-run";
import { v1ExecutionSummary } from "../../../features/coforge/application/execution-v1-adapter";
import { councilHistoryActions } from "./council-history-actions";
import { useCouncilAsk } from "./use-council-ask";
import { useCouncilRunSelection } from "./council-run-selection";
import { useCouncilNavigation } from "./council-navigation";
import { useCouncilRunDisplay } from "./council-run-display";
import { refreshCouncil } from "./refresh-council";
import {
  councilRunState,
  legacyRunMatches,
  councilProgressAnnouncement,
} from "./council-monitor-display";

export function useCouncil(options: { workspace?: boolean } = {}) {
  const { host, studio: application } = useCoforge();
  const store = useCouncilStore();
  useCouncilRunSelection(store);
  let service =
    store.example && !host.council ? host.previewCouncil?.() : host.council;
  const studio = useStudioStore();
  if (options.workspace !== false) {
    consumeCouncilEntry(store, studio);
    store.viewMounted = true;
  }
  let closed = false;
  let stop = () => {};
  async function run(work: () => Promise<void>) {
    if (store.busy || closed) return;
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
            : "The Council action failed. Refresh its current state before retrying.";
    } finally {
      store.busy = false;
    }
  }
  async function refresh() {
    if (!service) return;
    const current = service;
    await refreshCouncil(current, store, () => !closed && current === service);
  }
  onMounted(() => {
    if (!service) return;
    store.state = service.snapshot();
    stop = service.subscribe((state) => {
      if (!closed) store.state = state;
    });
    let started = false;
    watch(() => [store.busy, store.state?.ready] as const, ([busy, ready]) => {
      if (!busy && ready && !started) { started = true; void run(refresh); }
    }, { immediate: true });
  });
  onBeforeUnmount(() => {
    if (options.workspace !== false) store.viewMounted = false;
    closed = true;
    stop();
  });
  watch(
    () => [store.source, store.target, store.team],
    () => {
      store.preview = null;
    },
  );
  watch(
    () => studio.state?.activeProjectId,
    () => {
      store.preview = null;
      store.team = "";
      store.target = "";
      store.taskSource = "";
    },
  );
  const teams = computed(() =>
    store.catalogue.valid.filter(
      (item) =>
        item.definition.schema === "team/v1" &&
        item.definition.projectId === studio.state?.activeProjectId,
    ),
  );
  const targets = computed(() =>
    store.catalogue.valid.filter(
      (item) =>
        item.definition.schema === "agent/v1" ||
        (item.definition.schema === "council/v1" &&
          item.definition.teamId === store.team),
    ),
  );
  function target(): CouncilTarget {
    const entry = targets.value.find(
      (item) => item.definition.id === store.target,
    );
    if (
      !entry ||
      (entry.definition.schema !== "agent/v1" &&
        entry.definition.schema !== "council/v1")
    )
      throw new Error("Select an agent or council.");
    return {
      kind: entry.definition.schema === "agent/v1" ? "agent" : "council",
      id: entry.definition.id,
      teamId: store.team,
    };
  }
  function requireService() {
    if (!service)
      throw new Error(
        "Open Council in desktop Obsidian to use vault-backed agents.",
      );
    return service;
  }
  function explore() {
    if (host.council || store.busy) return;
    service = host.previewCouncil?.();
    if (!service) return;
    beginExample();
    stop();
    model.service = service;
    store.example = true;
    store.state = service.snapshot();
    store.source = "CoForge/Examples/Council proposal.md";
    store.team = "team-example";
    store.target = "council-example";
    store.taskTeam = "team-example";
    store.taskCouncil = "council-example";
    stop = service.subscribe((state) => {
      if (!closed) store.state = state;
    });
    void run(refresh);
  }
  function exitExample() {
    if (!store.example) return;
    service?.pause();
    stop();
    service = host.council;
    model.service = service;
    resetCouncilExample();
    host.discardPreview?.("council");
  }
  const selectedRun = computed(() =>
    store.state?.runs.find((run) => run.id === store.inspectedRun && (!store.projectFilter || run.projectId === store.projectFilter)),
  );
  const checkpoint = computed(() =>
    selectedRun.value?.checkpoints?.find(
      (item) => item.id === selectedRun.value?.activeCheckpointId,
    ),
  );
  const handoffIdeas = computed(() =>
    (studio.state?.ideas ?? []).filter(
      (idea) =>
        idea.projectId === selectedRun.value?.projectId &&
        !["shipped", "rejected"].includes(idea.status),
    ),
  );
  const model = reactive({
    store,
    studio,
    navigation: useCouncilNavigation(store, () => studio.state?.activeProjectId),
    display: useCouncilRunDisplay(store, () => selectedRun.value, () => studio.state?.projects ?? []),
    ask: useCouncilAsk({
      store,
      service: requireService,
      current: (value) => value === service,
      available: () => Boolean(service),
      target,
      projectId: () => studio.state?.activeProjectId ?? "",
      closed: () => closed,
      refresh,
      run,
    }),
    selectPage: (page: CouncilPage) => {
      store.tab = page;
      if (
        [
          "ask",
          "submit",
          "inboxes",
          "workflows",
          "messages",
          "folders",
        ].includes(page)
      )
        void run(refresh);
    },
    service,
    listVaultFiles: host.listVaultFiles,
    teams,
    targets,
    refresh: () => run(refresh),
    checkRuntime: () =>
      run(async () => {
        await application.refreshRuntime();
        await refresh();
        store.notice =
          "Native runtime availability was checked without a model request.";
      }),
    example: computed(() => store.example),
    canPreview: Boolean(host.previewCouncil),
    explore,
    exitExample,
    projectId: computed(() => studio.state?.activeProjectId ?? ""),
    runs: computed(() =>
      (store.state?.runs ?? []).filter(
        (run) =>
          (!store.projectFilter || run.projectId === store.projectFilter) &&
          (!store.teamFilter || run.teamId === store.teamFilter) &&
          (!store.sourceFilter ||
            run.subject.sourceId
              .toLowerCase()
              .includes(store.sourceFilter.toLowerCase())) &&
          (!store.targetFilter ||
            run.invocations.some((item) =>
              item.agentId
                .toLowerCase()
                .includes(store.targetFilter.toLowerCase()),
            )) &&
          (!store.stateFilter || run.state === store.stateFilter),
      ),
    ),
    selectedRun,
    settling: computed(() => selectedRun.value?.attempts.some(attempt => attempt.status === 'dispatching') ?? false),
    runState: councilRunState,
    progressAnnouncement: computed(() => {
      const current =
        selectedRun.value ??
        store.state?.runs.find(
          (run) => !["completed", "cancelled"].includes(run.state),
        ) ??
        store.state?.runs[store.state.runs.length - 1];
      return current
        ? councilProgressAnnouncement(current)
        : "No Council work admitted.";
    }),
    checkpoint,
    completeCheckpoint: () =>
      run(async () => {
        if (!selectedRun.value || !checkpoint.value)
          throw new Error("Select the current human checkpoint.");
        await requireService().acknowledgeCheckpoint(
          selectedRun.value.id,
          checkpoint.value.id,
          [...store.checkpointItems],
          store.checkpointNote,
        );
        store.checkpointItems = [];
        store.checkpointNote = "";
      }),
    artifactLabel: (run: ExecutionRun, artifact: ExecutionArtifact) =>
      isWorkflowV2Run(run)
        ? `${artifact.roundId} · ${artifact.agentId}`
        : councilArtifactLabel(run, artifact),
    legacyRuns: computed(() =>
      (studio.state?.ideas ?? [])
        .flatMap((idea) => [
          ...(idea.workflowHistory ?? []),
          ...(idea.workflowRun ? [idea.workflowRun] : []),
        ])
        .map(v1ExecutionSummary)
        .filter((run) => legacyRunMatches(run, store)),
    ),
    handoffIdeas,
    ...councilHistoryActions({
      store,
      service: requireService,
      run,
      ideas: handoffIdeas,
    }),
    designate: () =>
      run(async () => {
        await requireService().designateExecutor();
        store.notice =
          "This desktop is designated. Execution remains paused until you resume.";
      }),
    resume: () =>
      run(async () => {
        await requireService().resume();
      }),
    pause: () => {
      service?.pause();
    },
    pauseProject: () =>
      run(async () => {
        const projectId = studio.state?.activeProjectId;
        if (!projectId) throw new Error("Select a project first.");
        await requireService().pauseProject(
          projectId,
          !(store.state?.preferences.pausedProjectIds ?? []).includes(
            projectId,
          ),
        );
      }),
    continueSnapshot: (id: string) =>
      run(async () => {
        await requireService().continueSnapshot(id);
        store.notice =
          "The original captured input remains authoritative. Acknowledged source edits are preserved.";
      }),
    skip: (id: string) =>
      run(async () => {
        await requireService().skipInvocation(
          id,
          store.skipReason,
          store.acknowledge,
        );
        store.skipReason = "";
        store.acknowledge = false;
      }),
    ...councilSubmissionActions({
      store,
      service: requireService,
      target,
      projectId: () => studio.state?.activeProjectId ?? "",
      closed: () => closed,
      run,
    }),
    ...councilInboxActions({
      store,
      service: requireService,
      projectId: () => studio.state?.activeProjectId ?? "",
      target,
      run,
    }),
    repair: (id: string) =>
      run(async () => {
        await requireService().repair(id);
        store.notice =
          "The committed result was published without invoking a provider.";
      }),
    retry: (id: string) =>
      run(async () => {
        await requireService().retry(id, store.acknowledge);
        store.acknowledge = false;
      }),
    cancel: (id: string) =>
      run(async () => {
        await requireService().cancel(id);
      }),
    pauseRun: (id: string, paused: boolean) =>
      run(async () => {
        await requireService().pauseRun(id, paused);
      }),
    runAgain: (sourceId: string) =>
      run(async () => {
        await requireService().runAgain(sourceId);
        store.notice =
          "A new submission generation was created. Active inboxes will reconcile it.";
      }),
  });
  const beginExample = useTemporaryExample("council", exitExample);
  provide(councilModelKey, model);
  return model;
}

const councilModelKey: InjectionKey<ReturnType<typeof useCouncil>> = Symbol(
  "council-presentation",
);
export function useCouncilModel(): ReturnType<typeof useCouncil> {
  const model = inject(councilModelKey);
  if (!model) throw new Error("Council presentation context is unavailable.");
  return model;
}
