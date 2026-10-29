import {
  computed,
  inject,
  onMounted,
  provide,
  reactive,
  toRaw,
  watch,
} from "vue";
import { useCouncilEditorStore } from "../../stores/coforge-council-editor";
import { useStudioStore } from '../../stores/coforge-studio';
import { useCouncilDefinitionDrafts } from "./council-definition-drafts";
import { useCouncilConnectionForm } from "./council-connection-form";
import { councilSetupReadiness } from './council-setup-readiness';
import { useCouncilCatalogueProjection } from './council-catalogue-projection';
import type {
  CouncilCatalogueActions,
} from "../../../features/coforge/application/council-catalogue";
import {
  agentDefinitionCheck,
  defaultCouncilDefinition,
  type CouncilRound,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
const COUNCIL_EDITOR_KEY = Symbol("coforge-council-editor");

export function useCouncilDefinitions(props: {
  catalogue: CouncilCatalogueActions;
  projectId: string;
  mode?: 'coworkers';
  teamsOnly?: boolean;
}) {
  const store = useCouncilEditorStore(props.mode === 'coworkers' ? 'coworkers' : 'council');
  const studio = useStudioStore();
  const drafts = useCouncilDefinitionDrafts(store, () => props.projectId);
  const { catalogue, snapshot, load } = useCouncilCatalogueProjection({ store, projectId: () => props.projectId, read: () => props.catalogue.list(), action, refreshed: drafts.refresh });
  const agents = computed(() =>
    catalogue.valid.filter((item) => item.definition.schema === "agent/v1"),
  );
  const teams = computed(() =>
    catalogue.valid.filter(
      (item) =>
        item.definition.schema === "team/v1" &&
        item.definition.projectId === props.projectId,
    ),
  );
  const entries = computed(() =>
    catalogue.valid.filter(
      (item) =>
        (item.definition.schema === "agent/v1" ? !props.teamsOnly :
          item.definition.projectId === props.projectId) &&
        `${item.definition.name} ${item.definition.id} ${item.definition.schema} ${item.definition.schema === 'agent/v1' ? item.definition.role : ''}`
          .toLowerCase()
          .includes(store.search.trim().toLowerCase()),
    ),
  );
  const readiness = computed(() => councilSetupReadiness(catalogue, props.projectId));
  async function action(work: () => Promise<void>) {
    if (store.busy) return;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
    } catch (error) {
      store.error =
        error instanceof Error
          ? error.message
          : "The action failed. Refresh and try again.";
    } finally {
      store.busy = false;
    }
  }
  const select = drafts.select;
  const fresh = drafts.fresh;
  function createAgent() {
    fresh(
      agentDefinitionCheck({
        schema: "agent/v1",
        id: `agent-${crypto.randomUUID()}`,
        name: "New CoWorker",
        enabled: false,
        role: "",
        instructions: "",
        provider: "demo",
        model: "sonnet",
        contextSources: [],
        requestedCapabilities: { project: "none", messaging: false },
      }),
    );
  }
  function createCouncil() {
    const selectedTeam = store.draft?.schema === 'team/v1' ? store.draft.id : store.draft?.schema === 'council/v1' ? store.draft.teamId : '';
    const owner = (readiness.value.usableTeams.find(entry => entry.definition.id === selectedTeam) ?? readiness.value.usableTeams[0])?.definition;
    const members = owner?.schema === 'team/v1' ? owner.members.filter(id => readiness.value.agents.some(entry => entry.definition.id === id)) : [];
    if (!owner || owner.schema !== "team/v1" || !owner.enabled || !members.length) {
      store.error =
        "Add saved CoWorkers to the project team before creating a council.";
      return;
    }
    fresh({
      ...defaultCouncilDefinition(
        `council-${crypto.randomUUID()}`,
        "New council",
        owner,
        members,
      ),
      enabled: false,
    });
  }
  function createTeam() {
    fresh({
      schema: "team/v1",
      id: `team-${crypto.randomUUID()}`,
      name: "New team",
      enabled: true,
      projectId: props.projectId,
      members: [],
      pinnedContext: [],
      recentMessages: 10,
      allowedRecipients: [],
    });
  }
  function toggleMember(id: string, checked: boolean) {
    const draft = store.draft;
    if (!draft || draft.schema === "agent/v1") return;
    draft.members = checked
      ? [...new Set([...draft.members, id])]
      : draft.members.filter((member) => member !== id);
    if (draft.schema === "council/v1")
      for (const round of draft.rounds)
        round.participants = checked
          ? [...new Set([...round.participants, id])]
          : round.participants.filter((member) => member !== id);
  }
  function move<T>(items: T[], index: number, delta: number) {
    if (index + delta < 0 || index + delta >= items.length) return;
    const item = items.splice(index, 1)[0];
    if (item !== undefined) items.splice(index + delta, 0, item);
  }
  function addRound() {
    const draft = store.draft;
    if (draft?.schema !== "council/v1") return;
    draft.rounds.push({
      id: `round-${crypto.randomUUID()}`,
      name: "New round",
      kind: "solution",
      participants: [...draft.members],
      instructions: "",
      inputs: [],
      output: "markdown",
      access: "none",
      completion: { kind: "all" },
    });
  }
  function duplicateRound(index: number) {
    const draft = store.draft;
    if (draft?.schema !== "council/v1") return;
    const original = draft.rounds[index];
    if (original)
      draft.rounds.splice(index + 1, 0, {
        ...structuredClone(toRaw(original)),
        id: `round-${crypto.randomUUID()}`,
        name: `${original.name} copy`,
      });
  }
  function toggleInput(round: CouncilRound, id: string, checked: boolean) {
    round.inputs = checked
      ? [...new Set([...round.inputs, id])]
      : round.inputs.filter((input) => input !== id);
  }
  function partial(round: CouncilRound, checked: boolean) {
    round.completion = checked
      ? { kind: "partial", minimum: 1 }
      : { kind: "all" };
  }
  function setLines(
    field: "contextSources" | "pinnedContext" | "allowedRecipients",
    event: Event,
  ) {
    if (!(event.target instanceof HTMLTextAreaElement)) return;
    const values = event.target.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const draft = store.draft;
    if (draft?.schema === "agent/v1" && field === "contextSources")
      draft.contextSources = values;
    if (draft?.schema === "team/v1" && field === "pinnedContext")
      draft.pinnedContext = values;
    if (draft?.schema === "team/v1" && field === "allowedRecipients")
      draft.allowedRecipients = values;
  }
  const owner = computed<TeamDefinition | undefined>(() => {
    const draft = store.draft;
    if (draft?.schema !== "council/v1") return undefined;
    const team = catalogue.valid.find(
      (item) => item.definition.id === draft.teamId,
    )?.definition;
    return team?.schema === "team/v1" ? team : undefined;
  });
  const memberOptions = computed(() =>
    store.draft?.schema === "council/v1"
      ? agents.value.filter((item) =>
          owner.value?.members.includes(item.definition.id),
        )
      : agents.value,
  );
  watch(
    () => (store.draft?.schema === "council/v1" ? store.draft.teamId : ""),
    (current, previous) => {
      const draft = store.draft;
      if (!previous || previous === current || draft?.schema !== "council/v1")
        return;
      const allowed = owner.value?.members ?? [];
      draft.members = draft.members.filter((id) => allowed.includes(id));
      for (const round of draft.rounds)
        round.participants = round.participants.filter((id) =>
          draft.members.includes(id),
        );
    },
  );
  function membership(id: string): string {
    return (
      catalogue.valid.find((item) => item.definition.id === id)?.definition
        .name ?? id
    );
  }
  const setup = () =>
    action(async () => {
      snapshot(await props.catalogue.setup(props.projectId));
      store.notice = "The project team is ready. Add agents to its roster.";
    });
  const save = () =>
    action(async () => {
      if (!store.draft) return;
      const projectId = store.projectId;
      const id = store.draft.id;
      const definition = structuredClone(toRaw(store.draft));
      if (
        definition.schema === "agent/v1" &&
        !definition.connectionProfile?.trim()
      )
        delete definition.connectionProfile;
      snapshot(await props.catalogue.save(definition, store.revision));
      const saved = catalogue.valid.find((item) => item.definition.id === id);
      if (saved) drafts.markSaved(saved, projectId);
      store.notice = "Definition saved for future runs.";
    });
  const duplicate = () =>
    action(async () => {
      if (!store.draft || !store.revision) return;
      drafts.preserve();
      const projectId = store.projectId;
      const id = `${store.draft.schema.split("/")[0]}-${crypto.randomUUID()}`;
      snapshot(await props.catalogue.duplicate(store.draft.id, id));
      const created = catalogue.valid.find((item) => item.definition.id === id);
      if (created && projectId === props.projectId) select(created);
    });
  const archive = () =>
    action(async () => {
      if (!store.draft || !store.revision) return;
      if (drafts.dirty.value)
        throw new Error(
          "Save or explicitly discard your draft before archiving this definition.",
        );
      const projectId = store.projectId;
      const id = store.draft.id;
      snapshot(await props.catalogue.archive(id, store.revision));
      const saved = catalogue.valid.find((item) => item.definition.id === id);
      if (saved) drafts.markSaved(saved, projectId);
    });
  const discard = () =>
    action(async () => {
      const id = store.draft?.id;
      const projectId = store.projectId;
      snapshot(await props.catalogue.list());
      if (store.projectId === projectId && store.draft?.id === id)
        drafts.discard(
          catalogue.valid.find((entry) => entry.definition.id === id),
        );
    });
  const open = () =>
    action(async () => {
      if (store.draft && store.revision)
        await props.catalogue.open(store.draft.id);
    });
  const previewImport = () =>
    action(async () => {
      store.preview = await props.catalogue.previewImport(store.importJson);
    });
  const applyImport = () =>
    action(async () => {
      if (!store.preview) return;
      const selected = store.draft?.id;
      const projectId = store.projectId;
      const keepDraft = drafts.dirty.value;
      snapshot(
        await props.catalogue.applyImport(
          structuredClone(toRaw(store.preview)),
        ),
      );
      const imported = catalogue.valid.find(
        (entry) => entry.definition.id === selected,
      );
      if (imported && !keepDraft) drafts.markSaved(imported, projectId);
      store.preview = null;
      store.notice = keepDraft
        ? "Imported definition saved disabled. Your unsaved draft is preserved; discard it to inspect the imported version."
        : "Imported definition saved disabled. Review local permissions before enabling it.";
    });
  const exportDefinition = () =>
    action(async () => {
      if (store.draft && store.revision)
        store.exportJson = await props.catalogue.export(store.draft.id);
    });
  watch(
    () => store.importJson,
    () => {
      store.preview = null;
    },
  );
  onMounted(load);
  watch(
    () => props.projectId,
    (id) => {
      drafts.switchProject(id);
      drafts.refresh(catalogue.valid);
      store.preview = null;
    },
  );
  const model = reactive({
    store,
    catalogueActions: props.catalogue,
    catalogue,
    projectId: computed(() => props.projectId),
    readiness,
    agents,
    teams,
    entries,
    ...useCouncilConnectionForm(store),
    dirty: drafts.dirty,
    unsaved: drafts.unsaved,
    restoreDraft: drafts.restore,
    changed: drafts.changed,
    discard,
    memberOptions,
    owner,
    load,
    setup,
    select,
    createAgent,
    manageCoWorkers: () => studio.navigate('coworkers'),
    createTeam,
    createCouncil,
    toggleMember,
    move,
    addRound,
    duplicateRound,
    toggleInput,
    partial,
    setLines,
    membership,
    save,
    duplicate,
    archive,
    open,
    previewImport,
    applyImport,
    exportDefinition,
  });
  provide(COUNCIL_EDITOR_KEY, model);
  return model;
}
export type CouncilEditorModel = ReturnType<typeof useCouncilDefinitions>;
export function useCouncilEditorForm(): CouncilEditorModel {
  const model = inject<CouncilEditorModel>(COUNCIL_EDITOR_KEY);
  if (!model) throw new Error("Council editor provider is unavailable.");
  return model;
}
