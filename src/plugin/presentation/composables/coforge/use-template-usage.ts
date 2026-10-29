import { computed, reactive, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useTemplateUsageStore } from "../../stores/coforge-template-usage";
import { useStudioStore } from "../../stores/coforge-studio";
import { useWorkflowV2Store } from "../../stores/coforge-workflow-v2";

export function useTemplateUsage(props: {
  projectId: string;
  templateId: string;
  revision?: string;
}) {
  const { host } = useCoforge();
  const store = useTemplateUsageStore();
  const studio = useStudioStore();
  const proposal = useWorkflowV2Store();
  const state = computed(() => store.entry(props.projectId, props.templateId));
  async function refresh() {
    const projectId = props.projectId;
    const templateId = props.templateId;
    if (!projectId || !templateId || !host.outputTemplates?.references) return;
    const current = store.entry(projectId, templateId);
    const request = ++current.request;
    current.loading = true;
    current.error = "";
    try {
      const result = await host.outputTemplates.references(
        projectId,
        templateId,
      );
      if (request !== current.request) return;
      current.references = result.references;
      current.unavailable = result.unavailable;
    } catch {
      if (request === current.request) {
        current.references = [];
        current.error =
          "Saved workflow references could not be inspected. Refresh and review workflow settings before deleting.";
      }
    } finally {
      if (request === current.request) current.loading = false;
    }
  }
  watch(
    () => [
      props.projectId,
      props.templateId,
      props.revision,
      studio.state?.projects?.find((item) => item.id === props.projectId)
        ?.settings.workflow?.revision,
      proposal.projectId === props.projectId ? proposal.revision : "",
    ],
    () => {
      void refresh();
    },
    { immediate: true },
  );
  return reactive({
    state,
    available: Boolean(host.outputTemplates?.references),
    refresh: () => {
      void refresh();
    },
  });
}
