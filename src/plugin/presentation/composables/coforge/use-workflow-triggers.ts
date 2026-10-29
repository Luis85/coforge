import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useCouncilStore } from "../../stores/coforge-council";
import { useWorkflowTriggersStore } from "../../stores/coforge-workflow-triggers";
import {
  WORKFLOW_TRIGGER_EVENTS,
  type WorkflowTrigger,
} from "../../../features/coforge/domain/workflow-triggers";
export function useWorkflowTriggers() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const council = useCouncilStore();
  const form = useWorkflowTriggersStore();
  let service = form.example ? host.previewWorkflowTriggers?.() : host.workflowTriggers;
  const available = ref(Boolean(service));
  form.draft.workflowRevision = '';
  const snapshot = ref(service?.snapshot());
  const busy = ref(false);
  const error = ref("");
  const notice = ref("");
  const reviewedName = ref("");
  const subject = ref<"note" | "idea">("idea");
  let closed = false;
  let generation = 0;
  let stop = service?.subscribe((value) => {
    snapshot.value = value;
  });
  onBeforeUnmount(() => {
    closed = true;
    generation++;
    stop?.();
  });
  if (!form.draft.projectId)
    form.draft.projectId = studio.activeProject?.id ?? "";
  async function run(work: () => Promise<void>) {
    if (busy.value || closed) return;
    busy.value = true;
    error.value = "";
    notice.value = "";
    try {
      await work();
    } catch (cause) {
      if (!closed)
        error.value =
          cause instanceof Error
            ? cause.message
            : "The trigger action failed. Refresh before retrying.";
    } finally {
      busy.value = false;
    }
  }
  watch(
    () => [form.draft.projectId, form.draft.workflow],
    () => {
      generation++;
      form.draft.workflowRevision = "";
      reviewedName.value = "";
    },
  );
  function edit(binding: WorkflowTrigger) {
    generation++;
    form.id = binding.id;
    form.revision = binding.revision;
    form.acknowledge = false;
    form.draft = {
      name: binding.name,
      enabled: binding.enabled,
      event: binding.event,
      scope: binding.scope,
      projectId: binding.projectId,
      workflow: binding.workflow,
      workflowRevision: "",
      request: binding.request,
      ...(binding.ideaId ? { ideaId: binding.ideaId } : {}),
      cooldownSeconds: binding.cooldownSeconds,
    };
    reviewedName.value = "";
    notice.value =
      "Review the currently saved workflow before saving this trigger.";
  }
  function reset() {
    generation++;
    form.id = "";
    form.revision = 0;
    form.acknowledge = false;
    form.draft = {
      name: "",
      enabled: false,
      event: "request-created",
      scope: "project",
      projectId: studio.activeProject?.id ?? "",
      workflow: "v1",
      workflowRevision: "",
      request: "event",
      cooldownSeconds: 60,
    };
    reviewedName.value = "";
  }
  return reactive({
    form,
    snapshot,
    busy,
    error,
    notice,
    reviewedName,
    subject,
    events: WORKFLOW_TRIGGER_EVENTS,
    available, canPreview: Boolean(host.previewWorkflowTriggers),
    explore: () => {
      service = host.previewWorkflowTriggers?.(); if (!service) return;
      form.example = true; available.value = true; snapshot.value = service.snapshot();
      stop = service.subscribe(value => { snapshot.value = value; });
      notice.value = 'Event-trigger example · memory only. No vault writes or provider dispatch.';
    },
    projects: computed(
      () =>
        studio.state?.projects?.filter((project) => !project.unavailable) ?? [],
    ),
    ideas: computed(
      () =>
        studio.state?.ideas.filter(
          (idea) => (idea.projectId ?? "CFP-001") === form.draft.projectId,
        ) ?? [],
    ),
    owned: computed(
      () => council.state?.executor === true && snapshot.value?.ready === true,
    ),
    edit,
    reset,
    occurrences: computed(() =>
      [...(snapshot.value?.occurrences ?? [])].reverse().slice(0, 30),
    ),
    review: () =>
      run(async () => {
        if (!service) return;
        const current = ++generation;
        const definition = await service.describe(
          form.draft.projectId,
          form.draft.workflow,
        );
        if (closed || current !== generation) return;
        form.draft.workflowRevision = definition.revision;
        reviewedName.value = definition.name;
        subject.value = definition.subject;
        if (definition.subject === "note") {
          form.draft.request = "event";
          delete form.draft.ideaId;
        }
      }),
    save: () =>
      run(async () => {
        if (!service) return;
        const input = { ...form.draft };
        if (input.request === "event") delete input.ideaId;
        await service.save(
          input,
          form.id || undefined,
          form.id ? form.revision : undefined,
          form.acknowledge,
        );
        reset();
        notice.value =
          "Trigger saved. Only future matching events will be considered.";
      }),
    remove: (binding: WorkflowTrigger) =>
      run(async () => {
        await service?.remove(binding.id, binding.revision);
        if (form.id === binding.id) reset();
        notice.value = "Trigger removed. Its run evidence is retained.";
      }),
    refresh: () =>
      run(async () => {
        await service?.refresh();
        notice.value = "Trigger journal refreshed. Missed events were skipped.";
      }),
    monitor: (runId: string) => {
      council.inspectedRun = runId;
      council.tab = "monitor";
    },
  });
}
