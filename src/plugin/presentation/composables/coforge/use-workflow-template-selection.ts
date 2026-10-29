import { computed } from "vue";
import { useOutputTemplateStore } from "../../stores/coforge-output-templates";
/** A step's selected source is independent of the library's currently edited template. */
export function useWorkflowTemplateSelection(
  projectId: () => string,
  selectedId: () => string | undefined,
) {
  const store = useOutputTemplateStore();
  return computed(() =>
    store
      .editor(projectId())
      .templates.find((template) => template.id === selectedId()),
  );
}
