import type {
  WorkflowV2Binding,
  WorkflowV2Definition,
  WorkflowV2Step,
} from "../../../features/coforge/domain/configured-workflow-v2";
export const WORKFLOW_V2_KIND_LABELS = {
  agent: "CoWorker answer",
  council: "Council discussion",
  approval: "Human approval",
  checklist: "Human checklist",
  message: "Team message",
} as const;
export const WORKFLOW_MESSAGE_TOKENS = [
  "{{source}}",
  "{{inputs}}",
  "{{decisions}}",
] as const;

export function newWorkflowV2Step(
  kind: WorkflowV2Step["kind"],
  previous?: WorkflowV2Step,
): WorkflowV2Step {
  const base = {
    id: previous?.id ?? `step-${crypto.randomUUID()}`,
    name: previous?.name ?? "New step",
    instructions: previous?.instructions ?? "",
  };
  if (kind === "approval") return { ...base, kind };
  if (kind === "checklist")
    return {
      ...base,
      kind,
      items: [
        {
          id: `item-${crypto.randomUUID()}`,
          label: "Review the proposal",
          required: true,
        },
      ],
    };
  if (kind === "agent")
    return {
      ...base,
      kind,
      agentId: "",
      output: "markdown",
      access: "none",
      inputs: [],
    };
  if (kind === "message")
    return {
      ...base,
      kind,
      purpose: "information",
      recipientId: "",
      body: "",
      inputs: [],
    };
  return { ...base, kind, councilId: "", inputs: [] };
}
export function moveWorkflowV2Item<T>(
  items: T[],
  index: number,
  delta: number,
): void {
  if (index + delta < 0 || index + delta >= items.length) return;
  const item = items.splice(index, 1)[0];
  if (item !== undefined) items.splice(index + delta, 0, item);
}
export function replaceWorkflowV2Step(
  definition: WorkflowV2Definition,
  index: number,
  event: Event,
): void {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const kind = event.target.value;
  if (
    kind === "agent" ||
    kind === "council" ||
    kind === "approval" ||
    kind === "checklist" ||
    kind === "message"
  )
    definition.steps[index] = newWorkflowV2Step(kind, definition.steps[index]);
}
export function changeWorkflowV2Binding(
  step: WorkflowV2Step,
  index: number,
  event: Event,
): void {
  if (
    !(event.target instanceof HTMLSelectElement) ||
    (step.kind !== "agent" &&
      step.kind !== "council" &&
      step.kind !== "message")
  )
    return;
  const kind = event.target.value;
  const binding: WorkflowV2Binding =
    kind === "collection"
      ? { kind, collectionId: "" }
      : kind === "artifact"
        ? { kind, producerStepId: "", artifactId: "" }
        : { kind: "producer", stepId: "" };
  step.inputs[index] = binding;
}
export function toggleWorkflowV2Producer(
  collection: WorkflowV2Definition["collections"][number],
  producer: string,
): void {
  collection.producers = collection.producers.includes(producer)
    ? collection.producers.filter((id) => id !== producer)
    : [...collection.producers, producer];
}
export function addWorkflowV2ChecklistItem(step: WorkflowV2Step): void {
  if (step.kind === "checklist")
    step.items.push({
      id: `item-${crypto.randomUUID()}`,
      label: "New check",
      required: true,
    });
}
