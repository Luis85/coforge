import { computed, onMounted, ref, reactive } from "vue";
import { useWorkflowEditorForm } from "./use-workflow-editor";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import type {
  TeamDefinition,
  AgentDefinition,
} from "../../../features/coforge/domain/council-definitions";
export function useWorkflowNudge() {
  const editor = useWorkflowEditorForm();
  const { host } = useCoforge();
  const studio = useStudioStore();
  const definitions = ref<Array<TeamDefinition | AgentDefinition>>([]);
  const error = ref("");
  onMounted(async () => {
    try {
      const catalogue = await host.council?.catalogue.list();
      definitions.value =
        catalogue?.valid.flatMap((entry) =>
          entry.definition.schema === "council/v1" ? [] : [entry.definition],
        ) ?? [];
    } catch {
      error.value =
        "Could not load teams and agents. Open Council definitions to repair them.";
    }
  });
  const step = computed(() =>
    editor.selected?.kind === "nudge" ? editor.selected : null,
  );
  const teams = computed(() =>
    definitions.value.filter(
      (definition): definition is TeamDefinition =>
        definition.schema === "team/v1" &&
        definition.enabled &&
        definition.projectId === studio.activeProject?.id,
    ),
  );
  const agents = computed(() => {
    const team = teams.value.find((team) => team.id === step.value?.teamId);
    return definitions.value.filter(
      (definition): definition is AgentDefinition =>
        definition.schema === "agent/v1" &&
        definition.enabled &&
        team?.members.includes(definition.id) === true &&
        team.allowedRecipients.includes(definition.id),
    );
  });
  const inputs = computed(() => [...new Set(editor.draft.steps.slice(0, editor.draft.steps.findIndex(item => item.id === step.value?.id)).flatMap(item => item.kind === 'ai' ? [item.output] : []))]);
  return reactive({ step, teams, agents, error, inputs,
    toggleRole: (role: import('../../../features/coforge/domain/configured-workflow').WorkflowOutput) => { const current = step.value; if (current) current.inputs = current.inputs?.includes(role) ? current.inputs.filter(item => item !== role) : [...(current.inputs ?? []), role]; },
  });
}
