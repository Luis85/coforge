import {
  computed,
  inject,
  onMounted,
  provide,
  reactive,
  toRaw,
  watch,
} from "vue";
import type {
  CouncilCatalogueActions,
  CouncilCatalogueSnapshot,
} from "../../../features/coforge/application/council-catalogue";
import type {
  StoredWorkflowV2,
  WorkflowV2Actions,
} from "../../../features/coforge/application/workflow-v2-ports";
import { parseWorkflowV2Definition } from "../../../features/coforge/domain/configured-workflow-v2";
import { reviewedWorkflowIdentity } from "../../../features/coforge/application/reviewed-preflight";
import { useWorkflowV2Store } from "../../stores/coforge-workflow-v2";
import { useWorkflowV2ProjectDrafts } from "./workflow-v2-project-drafts";
import {
  changeWorkflowV2Binding,
  addWorkflowV2ChecklistItem,
  moveWorkflowV2Item,
  newWorkflowV2Step,
  replaceWorkflowV2Step,
  toggleWorkflowV2Producer,
  WORKFLOW_MESSAGE_TOKENS,
} from "./workflow-v2-draft";

const EDITOR = Symbol("coforge-workflow-v2-editor");
export function useWorkflowV2Editor(props: {
  actions: WorkflowV2Actions;
  catalogue: CouncilCatalogueActions;
  projectId: string;
}) {
  const store = useWorkflowV2Store();
  const drafts = useWorkflowV2ProjectDrafts(store);
  const catalogue = reactive<CouncilCatalogueSnapshot>({
    valid: [],
    invalid: [],
  });
  const teams = computed(() =>
    catalogue.valid.filter(
      (item) =>
        item.definition.schema === "team/v1" &&
        item.definition.projectId === props.projectId,
    ),
  );
  const agents = computed(() =>
    catalogue.valid.filter((item) => item.definition.schema === "agent/v1"),
  );
  const councils = computed(() =>
    catalogue.valid.filter(
      (item) =>
        item.definition.schema === "council/v1" &&
        item.definition.teamId === store.draft?.teamId,
    ),
  );
  const dirty = drafts.dirty;
  let loadGeneration = 0;
  async function action(work: () => Promise<void>) {
    if (store.busy) return;
    const generation = loadGeneration;
    const projectId = props.projectId;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
    } catch (error) {
      if (generation === loadGeneration && projectId === props.projectId)
        store.error =
          error instanceof Error
            ? error.message
            : "The proposal workflow action failed. Keep your draft and refresh before retrying.";
    } finally {
      if (generation === loadGeneration) store.busy = false;
    }
  }
  function apply(saved: StoredWorkflowV2) {
    store.draft = saved.definition
      ? structuredClone(toRaw(saved.definition))
      : null;
    store.revision = saved.revision;
    store.saved = JSON.stringify(store.draft);
    store.preview = null;
  }
  async function load(discard = false) {
    const generation = ++loadGeneration;
    const projectId = props.projectId;
    drafts.enter(projectId);
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      const values = await Promise.all([
        props.catalogue.list(),
        props.actions.load(projectId),
      ]);
      if (generation !== loadGeneration || projectId !== props.projectId)
        return;
      catalogue.valid = values[0].valid;
      catalogue.invalid = values[0].invalid;
      if (discard || !dirty.value) {
        apply(values[1]);
        drafts.preserve();
      } else
        store.notice =
          "Saved data refreshed. Your unsaved project draft is preserved; discard it explicitly to use the saved definition.";
      store.projectId = projectId;
    } catch (error) {
      if (generation === loadGeneration)
        store.error =
          error instanceof Error
            ? error.message
            : "Could not load this project workflow. Refresh and try again.";
    } finally {
      if (generation === loadGeneration) store.busy = false;
    }
  }
  function create() {
    const teamId = teams.value[0]?.definition.id ?? `team-${props.projectId}`;
    store.draft = {
      format: "coforge-workflow/v2",
      revision: `definition-${crypto.randomUUID()}`,
      name: "Proposal workflow",
      subjectMode: "note",
      teamId,
      limits: {
        timeoutSeconds: 180,
        maxTurns: 12,
        maxBudgetUsd: 1,
        maxInvocations: 24,
      },
      collections: [],
      steps: [
        {
          id: `step-${crypto.randomUUID()}`,
          kind: "approval",
          name: "Review proposal",
          instructions: "",
        },
      ],
    };
    store.revision = "";
    store.error = "";
    store.preview = null;
  }
  const save = () =>
    action(async () => {
      if (!store.draft) return;
      const projectId = props.projectId;
      const session = loadGeneration;
      const definition = structuredClone(toRaw(store.draft));
      const submitted = JSON.stringify(store.draft);
      drafts.preserve();
      definition.revision = `definition-${crypto.randomUUID()}`;
      const saved = await props.actions.save(
        projectId,
        definition,
        store.revision,
      );
      if (store.projectId === projectId) drafts.preserve();
      drafts.commit(projectId, saved, submitted);
      if (
        projectId !== props.projectId ||
        session !== loadGeneration ||
        submitted !== JSON.stringify(store.draft)
      ) {
        if (store.projectId === projectId) {
          store.revision = saved.revision;
          store.saved = JSON.stringify(saved.definition);
          drafts.preserve();
        }
        return;
      }
      apply(saved);
      drafts.preserve();
      store.notice =
        "Proposal workflow saved. New runs use this explicit v2 definition; existing v1 workflows remain available.";
    });
  function addStep() {
    store.draft?.steps.push(newWorkflowV2Step("agent"));
  }
  function duplicateStep(index: number) {
    const step = store.draft?.steps[index];
    if (!step || !store.draft) return;
    store.draft.steps.splice(index + 1, 0, {
      ...structuredClone(toRaw(step)),
      id: `step-${crypto.randomUUID()}`,
      name: `${step.name} copy`,
    });
  }
  function addCollection() {
    store.draft?.collections.push({
      id: `collection-${crypto.randomUUID()}`,
      producers: [],
    });
  }
  const previewImport = () =>
    action(async () => {
      store.importPreview = parseWorkflowV2Definition(store.importJson);
    });
  function replaceDraft() {
    if (store.importPreview) {
      store.draft = structuredClone(toRaw(store.importPreview));
      store.importPreview = null;
      store.preview = null;
    }
  }
  function exportDefinition() {
    if (store.draft) store.exportJson = JSON.stringify(store.draft, null, 2);
  }
  const preflight = () =>
    action(async () => {
      const source = store.source;
      const projectId = props.projectId;
      const preview = await props.actions.preflight(projectId, source);
      if (source !== store.source || projectId !== props.projectId) return;
      store.preview = preview;
      store.notice =
        "Preflight complete. No model request or message was sent.";
    });
  const start = (simulation = false) =>
    action(async () => {
      if (!simulation && !store.preview)
        throw new Error("Run preflight before submitting this workflow.");
      const run = await props.actions
        .start(
          props.projectId,
          store.source,
          simulation,
          simulation ? store.destination : undefined,
          store.preview
            ? reviewedWorkflowIdentity(toRaw(store.preview))
            : undefined,
        )
        .catch((error) => {
          store.preview = null;
          throw error;
        });
      store.notice = `${simulation ? "Simulation" : "Workflow"} ${run.id} retained. Resume Council execution and inspect it in the run monitor.`;
    });
  watch(
    () => store.importJson,
    () => {
      store.importPreview = null;
    },
  );
  watch(
    () => store.source,
    () => {
      store.preview = null;
    },
  );
  watch(dirty, (changed) => {
    if (changed) store.preview = null;
  });
  onMounted(() => {
    void load();
  });
  watch(
    () => props.projectId,
    () => {
      void load();
    },
  );
  const model = reactive({
    store,
    teams,
    agents,
    councils,
    dirty,
    load: () => load(),
    discard: () => load(true),
    create,
    save,
    addStep,
    duplicateStep,
    addCollection,
    previewImport,
    replaceDraft,
    exportDefinition,
    preflight,
    start,
    move: moveWorkflowV2Item,
    replaceStep: replaceWorkflowV2Step,
    changeBinding: changeWorkflowV2Binding,
    toggleProducer: toggleWorkflowV2Producer,
    addChecklistItem: addWorkflowV2ChecklistItem,
    messageTokens: WORKFLOW_MESSAGE_TOKENS,
  });
  provide(EDITOR, model);
  return model;
}
export type WorkflowV2EditorModel = ReturnType<typeof useWorkflowV2Editor>;
export function useWorkflowV2EditorForm(): WorkflowV2EditorModel {
  const model = inject<WorkflowV2EditorModel>(EDITOR);
  if (!model) throw new Error("Proposal workflow editor is unavailable.");
  return model;
}
