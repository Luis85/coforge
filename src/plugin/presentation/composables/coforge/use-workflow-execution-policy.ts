import { computed, reactive } from "vue";
import { useWorkflowEditorForm } from "./use-workflow-editor";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import {
  DEFAULT_DURABLE_IDLE_WARNING_SECONDS,
  type DurableBuildPolicy,
} from "../../../features/coforge/domain/durable-build";

type PolicyNumber = Exclude<keyof DurableBuildPolicy, "mode">;
export function useWorkflowExecutionPolicy() {
  const editor = useWorkflowEditorForm();
  const step = computed(() =>
    editor.selected?.kind === "ai" ? editor.selected : undefined,
  );
  const policy = computed(() => step.value?.execution);
  const eligible = computed(
    () =>
      step.value?.output === "codechange" &&
      step.value.access === "editworktree",
  );
  const mode = computed({
    get: () => (policy.value ? "background" : "foreground"),
    set: (value) => {
      const current = step.value;
      if (!current) return;
      if (value === "background")
        current.execution ??= {
          mode: "background",
          idleWarningSeconds: DEFAULT_DURABLE_IDLE_WARNING_SECONDS,
        };
      else delete current.execution;
    },
  });
  function enabled(key: PolicyNumber, fallback: () => number) {
    return computed({
      get: () => policy.value?.[key] !== undefined,
      set: (value) => {
        const current = policy.value;
        if (!current) return;
        if (value) current[key] = fallback();
        else delete current[key];
      },
    });
  }
  function value(
    key: PolicyNumber,
    fallback: () => number,
    scale = 1,
    integer = false,
  ) {
    return computed({
      get: () => (policy.value?.[key] ?? fallback()) / scale,
      set: (next) => {
        const current = policy.value;
        if (!current) return;
        const number = Number(next) * scale;
        current[key] = integer ? Math.round(number) : number;
      },
    });
  }
  const changed = computed(() => {
    const project = editor.project;
    if (!project || !step.value) return false;
    const saved = workflowDefinition(project.settings).steps.find(
      (item) => item.id === step.value?.id,
    );
    return (
      JSON.stringify(saved?.kind === "ai" ? saved.execution : undefined) !==
      JSON.stringify(policy.value)
    );
  });
  return reactive({
    step,
    policy,
    eligible,
    mode,
    changed,
    visible: computed(() => eligible.value || Boolean(policy.value)),
    unsupported: computed(() =>
      Boolean(
        policy.value &&
        (!eligible.value ||
          (step.value?.coworkerId === undefined &&
            !["claude", "codex"].includes(step.value?.provider ?? ""))),
      ),
    ),
    unresolvedCoworker: computed(() => Boolean(step.value?.coworkerId)),
    hasDeadline: enabled("maxRuntimeSeconds", () => 360000),
    deadlineHours: value("maxRuntimeSeconds", () => 360000, 3600, true),
    idleEnabled: computed({
      get: () => policy.value?.idleWarningSeconds !== 0,
      set: (active) => {
        if (policy.value)
          policy.value.idleWarningSeconds = active
            ? DEFAULT_DURABLE_IDLE_WARNING_SECONDS
            : 0;
      },
    }),
    idleMinutes: value(
      "idleWarningSeconds",
      () => DEFAULT_DURABLE_IDLE_WARNING_SECONDS,
      60,
      true,
    ),
    turnsEnabled: enabled("maxTurns", () => editor.draft.limits.maxTurns),
    turns: value("maxTurns", () => editor.draft.limits.maxTurns),
    budgetEnabled: enabled(
      "maxBudgetUsd",
      () => editor.draft.limits.maxBudgetUsd,
    ),
    budget: value("maxBudgetUsd", () => editor.draft.limits.maxBudgetUsd),
    inheritedTurns: computed(() => editor.draft.limits.maxTurns),
    inheritedBudget: computed(() => editor.draft.limits.maxBudgetUsd),
  });
}
