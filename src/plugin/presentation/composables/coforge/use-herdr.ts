import { computed, onBeforeUnmount, reactive, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useHerdrStore } from "../../stores/coforge-herdr";
import { useStudioStore } from "../../stores/coforge-studio";
import type { HerdrActions } from "../../../features/coforge/application/herdr-ports";
import { herdrReady, sameHerdrAgent } from "../../../features/coforge/domain/herdr";
export function useHerdr() {
  const { host } = useCoforge();
  const store = useHerdrStore();
  const studio = useStudioStore();
  let unsubscribe = () => {};
  let closed = false;
  const actions = (): HerdrActions | undefined =>
    store.example ? host.previewHerdr?.() : host.herdr;
  function connect() {
    unsubscribe();
    const service = actions();
    if (!service) return;
    store.state = service.snapshot();
    if (!store.executable) store.executable = store.state.settings.executable;
    if (!store.session) store.session = store.state.settings.session;
    unsubscribe = service.subscribe((value) => {
      if (!closed) {
        if (store.executable === store.state.settings.executable)
          store.executable = value.settings.executable;
        if (store.session === store.state.settings.session)
          store.session = value.settings.session;
        store.state = value;
      }
    });
  }
  connect();
  onBeforeUnmount(() => {
    closed = true;
    unsubscribe();
  });
  const project = computed(() =>
    studio.state?.projects?.find(
      (project) => project.id === studio.state?.activeProjectId,
    ),
  );
  watch(
    () =>
      `${project.value?.id}|${store.agent}|${store.request}|${store.workspace}`,
    () => {
      store.review = null;
      store.interruptConfirm = null;
    },
  );
  async function run(work: (service: HerdrActions) => Promise<void>) {
    const service = actions();
    if (!service) return;
    store.error = "";
    store.notice = "";
    try {
      await work(service);
    } catch (error) {
      if (!closed)
        store.error =
          error instanceof Error
            ? error.message
            : "Herdr could not be updated.";
    }
  }
  const observation = computed(() => store.state.observation);
  watch(observation, value => {
    if (!value?.panes.some(pane => pane.id === store.pane && !pane.agent)) store.pane = '';
    const target = value?.agents.find(agent => agent.paneId === store.agent);
    if (!target) store.agent = '';
    if (store.review && (!target || !herdrReady(target) || !sameHerdrAgent(target, store.review.target))) store.review = null;
    if (store.interruptConfirm && (!target || !sameHerdrAgent(target, store.interruptConfirm))) store.interruptConfirm = null;
  });
  return reactive({
    store,
    project,
    observation,
    herdrReady,
    available: computed(() => Boolean(actions())),
    canPreview: Boolean(host.previewHerdr),
    connected: computed(() =>
      Boolean(observation.value?.running && observation.value.compatible),
    ),
    unknown: computed(() =>
      store.state.records.filter((record) =>
        ["pending", "uncertain"].includes(record.status),
      ),
    ),
    agents: computed(
      () =>
        observation.value?.agents.filter(
          (agent) => !store.workspace || agent.workspaceId === store.workspace,
        ) ?? [],
    ),
    panes: computed(
      () =>
        observation.value?.panes.filter(
          (pane) =>
            !pane.agent &&
            (!store.workspace || pane.workspaceId === store.workspace),
        ) ?? [],
    ),
    requests: computed(
      () =>
        studio.state?.ideas.filter(
          (idea) =>
            idea.projectId === project.value?.id &&
            idea.screening?.verdict === "clear" &&
            !["accepted", "archived", "inbox", "flagged"].includes(idea.status),
        ) ?? [],
    ),
    preview: () => {
      store.example = true;
      connect();
      void run((service) => service.refresh());
    },
    refresh: () => {
      store.review = null;
      void run((service) => service.refresh());
    },
    configure: (event: Event) => {
      event.preventDefault();
      store.review = null;
      void run(async (service) => {
        await service.configure({
          executable: store.executable,
          session: store.session,
        });
        store.notice =
          "Herdr connection saved. Refresh to inspect the session.";
      });
    },
    createWorkspace: () => {
      if (project.value)
        void run((service) => service.createWorkspace(project.value!.id));
    },
    startAgent: () => {
      if (project.value)
        void run((service) =>
          service.startAgent(project.value!.id, store.pane, store.provider),
        );
    },
    focus: () => {
      void run((service) => service.focus(store.agent));
    },
    interrupt: () => {
      const target = observation.value?.agents.find(
        (agent) => agent.paneId === store.agent,
      );
      store.interruptConfirm = target ? { ...target } : null;
    },
    cancelInterrupt: () => {
      store.interruptConfirm = null;
    },
    confirmInterrupt: () => {
      const target = store.interruptConfirm;
      store.interruptConfirm = null;
      if (target) void run((service) => service.interrupt(target));
    },
    review: () => {
      try {
        store.review = actions()?.review(store.request, store.agent) ?? null;
        store.error = "";
      } catch (error) {
        store.error =
          error instanceof Error
            ? error.message
            : "The request could not be reviewed.";
      }
    },
    send: () => {
      const review = store.review;
      if (review)
        void run(async (service) => {
          await service.send(review);
          store.review = null;
          store.notice =
            "Request delivered to Herdr. Inspect its agent and review changes in CoForge; delivery does not mean completion.";
        });
    },
    acknowledge: (id: string) => {
      void run((service) => service.acknowledge(id));
    },
  });
}
