import { toRaw } from "vue";
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowOutput,
} from "../../features/coforge/domain/configured-workflow";
import { defaultWorkflowDefinition } from "../../features/coforge/domain/configured-workflow";
import type { AgentStage, Settings } from "../../features/coforge/domain/types";
export type WorkflowPreset = AgentStage | 'design';
export const WORKFLOW_OUTPUT_LABELS = {
  markdown: "Markdown report",
  design: "Design specification",
  screening: "Screening decision",
  rice: "RICE score",
  plan: "Implementation plan",
  codechange: "Code change",
} as const;
export const WORKFLOW_ACCESS_LABELS = {
  none: "No project access",
  readproject: "Read project",
  editworktree: "Edit isolated worktree",
} as const;
export const WORKFLOW_KIND_LABELS = {
  council: "Ask Council",
  nudge: "Nudge agent",
  ai: "AI step",
  approval: "Manual approval",
  checklist: "Manual checklist",
} as const;
export function moveWorkflowStep(
  definition: WorkflowDefinition,
  id: string,
  direction: -1 | 1,
): void {
  const index = definition.steps.findIndex((step) => step.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= definition.steps.length) return;
  if (definition.buckets && definition.steps[index]?.bucketId !== definition.steps[target]?.bucketId) return;
  const [step] = definition.steps.splice(index, 1);
  if (step) definition.steps.splice(target, 0, step);
}
export function duplicateWorkflowStep(
  definition: WorkflowDefinition,
  id: string,
): WorkflowStep | undefined {
  const index = definition.steps.findIndex((step) => step.id === id);
  const original = definition.steps[index];
  if (!original || definition.steps.length >= 40) return;
  const copy = structuredClone(toRaw(original));
  copy.id = crypto.randomUUID();
  copy.name = `${copy.name} copy`.slice(0, 100);
  if (copy.kind === "checklist")
    copy.items = copy.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
  definition.steps.splice(index + 1, 0, copy);
  return copy;
}
export function createWorkflowStep(
  kind: WorkflowStep["kind"],
  settings: Settings,
): WorkflowStep {
  const base = {
    id: crypto.randomUUID(),
    name:
      kind === "ai"
        ? "New AI step"
        : kind === "approval"
          ? "Manual approval"
          : "Manual checklist",
    instructions: "",
  };
  if (kind === "approval") return { ...base, kind };
  if (kind === 'council') return { ...base, name: 'Ask Council', kind, councilId: '', instructions: 'Review the captured request, compare options and explain risks and recommendations.', inputs: [], contextMode: 'all', automatic: false };
  if (kind === "nudge") return { ...base, name: "Nudge agent", kind, instructions: "Review the captured request and report your findings.", teamId: "", agentId: "", automatic: false, inputs: [] };
  if (kind === "checklist")
    return {
      ...base,
      kind,
      items: [
        { id: crypto.randomUUID(), label: "Review the result", required: true },
      ],
    };
  return {
    ...base,
    kind,
    provider: settings.provider,
    model: settings.model,
    output: "markdown",
    access: "none",
    automatic: false,
    minVotes: 0,
    ...(settings.provider === "herdr"
      ? { herdrAgent: settings.herdrAgent ?? "claude" }
      : {}),
  };
}
export function presetWorkflowStep(
  stage: WorkflowPreset,
  settings: Settings,
): WorkflowStep {
  const original = defaultWorkflowDefinition(settings).steps.find(
    (step) => step.id === stage,
  );
  if (!original) throw new Error("The standard step is unavailable.");
  return { ...structuredClone(toRaw(original)), id: crypto.randomUUID() };
}

export const WORKFLOW_PRESETS = [
  { id: "screen", name: "Screen" },
  { id: "score", name: "Score" },
  { id: "plan", name: "Plan" },
  { id: "design", name: "Design" },
  { id: "implement", name: "Build" },
] as const;

/** Explicit adoption updates only the local draft, retaining existing step identity and order. */
export function insertWorkflowPreset(definition: WorkflowDefinition, stage: WorkflowPreset, settings: Settings): WorkflowStep | undefined {
  if (definition.steps.length >= 40) return;
  const step = presetWorkflowStep(stage, settings);
  const buildIndex = stage === 'design' ? definition.steps.findIndex((item, index) => item.kind === 'ai' && item.output === 'codechange'
    && definition.steps.slice(0, index).some(prior => prior.kind === 'ai' && prior.output === 'plan')) : -1;
  if (buildIndex < 0) { definition.steps.push(step); return step; }
  const build = definition.steps[buildIndex];
  if (build?.kind === 'ai') {
    if (!build.inputs?.length) build.includePreviousResults = true;
    build.inputs = [...new Set<WorkflowOutput>([...(build.inputs ?? []), 'design'])];
  }
  definition.steps.splice(buildIndex, 0, step);
  return step;
}
