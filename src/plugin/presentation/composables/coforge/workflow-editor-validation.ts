import { CheckError } from "../../../features/coforge/domain/check";
import {
  workflowDefinitionCheck,
  workflowStepCheck,
  type WorkflowDefinition,
  type WorkflowOutput,
} from "../../../features/coforge/domain/configured-workflow";

export interface WorkflowEditorIssue {
  id: string;
  stepId?: string;
  target: string;
  label: string;
  message: string;
}
const labels: Record<string, string> = {
  name: "Step name",
  instructions: "Step instructions",
  model: "AI model",
  provider: "AI provider",
  access: "Project access",
  output: "Result contract",
  inputs: "Previous results",
  minVotes: "Minimum votes",
  items: "Checklist items",
  teamId: "Project team",
  agentId: "Agent recipient",
  councilId: "Council",
  steps: "Workflow steps",
  "limits.timeoutSeconds": "Step timeout",
  "limits.intervalSeconds": "Automatic run interval",
  "limits.maxTurns": "Native CLI turns",
  "limits.maxBudgetUsd": "Native CLI budget",
};
function targetFor(cause: unknown, step: boolean): string {
  if (cause instanceof CheckError) {
    const target = step && !cause.path.startsWith("items[")
      ? cause.path.split(/[.[\]]/u)[0] || "name"
      : cause.path;
    return target === 'contextMode' ? 'inputs' : target;
  }
  const message = cause instanceof Error ? cause.message : "";
  return message.includes("code-change")
    ? "access"
    : message.includes("prompt")
      ? "instructions"
      : message.includes("Checklist")
        ? "items"
        : "inputs";
}
/** Advisory repair targets use the same validators as saving; execution remains authoritative. */
export function workflowEditorIssues(
  definition: WorkflowDefinition,
): WorkflowEditorIssue[] {
  const issues: WorkflowEditorIssue[] = [];
  const available = new Set<WorkflowOutput>();
  definition.steps.forEach((step, index) => {
    try {
      workflowStepCheck(step);
    } catch (cause) {
      const target = targetFor(cause, true);
      const message =
        cause instanceof Error
          ? cause.message.replace(/^[^:]+: /u, "")
          : "Review this step.";
      issues.push({
        id: `step-${index}-field-${target}`,
        stepId: step.id,
        target:
          target === "model" && step.kind === "ai" && step.provider === "demo"
            ? "provider"
            : target,
        label: `${step.name || `Step ${index + 1}`} · ${labels[target.startsWith("items[") ? "items" : target] ?? "Step settings"}`,
        message:
          target === "model"
            ? `${step.kind === "ai" && step.provider === "demo" ? "Choose Claude Code or Herdr to edit the retained model. " : ""}Start the model name with a letter or number; use letters, numbers, dots, colons, underscores or hyphens.`
            : message,
      });
    }
    if (
      (step.kind === "ai" || step.kind === "nudge" || step.kind === 'council') &&
      (step.kind !== 'council' || !step.contextMode || step.contextMode === 'selected') &&
      step.inputs?.some((role) => !available.has(role))
    )
      issues.push({
        id: `step-${index}-inputs`,
        stepId: step.id,
        target: "inputs",
        label: `${step.name || `Step ${index + 1}`} · Previous results`,
        message:
          "A required result has no earlier producer. Move its producer earlier or remove that dependency.",
      });
    if (step.kind === "ai") {
      available.add(step.output);
      if (step.access === "editworktree") available.add("codechange");
    }
    if (step.kind === 'council') available.add('markdown');
  });
  try {
    workflowDefinitionCheck(definition);
  } catch (cause) {
    if (
      !issues.length ||
      (cause instanceof CheckError &&
        (cause.path === "name" || cause.path.startsWith("limits.")))
    ) {
      const target = cause instanceof CheckError ? cause.path : "name";
      issues.unshift({
        id: `workflow-${target}`,
        target,
        label:
          target === "name"
            ? "Workflow name"
            : (labels[target] ?? "Workflow settings"),
        message:
          target === "steps"
            ? "Add at least one workflow step."
            : cause instanceof Error
              ? cause.message.replace(/^[^:]+: /u, "")
              : "Review the workflow fields.",
      });
    }
  }
  return issues;
}
