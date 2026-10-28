import { boolean, list, number, oneOf, record, shape, text } from "./check";
import { workflowIdCheck } from "./configured-workflow";

export type WorkflowV2Binding =
  | { kind: "producer"; stepId: string }
  | { kind: "artifact"; producerStepId: string; artifactId: string }
  | { kind: "collection"; collectionId: string };
interface StepBase {
  id: string;
  name: string;
  instructions: string;
}
export interface AgentWorkflowV2Step extends StepBase {
  kind: "agent";
  agentId: string;
  output: "markdown" | "plan";
  access: "none";
  inputs: WorkflowV2Binding[];
}
export interface CouncilWorkflowV2Step extends StepBase {
  kind: "council";
  councilId: string;
  inputs: WorkflowV2Binding[];
}
export interface ApprovalWorkflowV2Step extends StepBase {
  kind: "approval";
}
export interface ChecklistWorkflowV2Step extends StepBase {
  kind: "checklist";
  items: { id: string; label: string; required: boolean }[];
}
export interface MessageWorkflowV2Step extends StepBase {
  kind: "message";
  purpose: "information" | "request";
  recipientId: string;
  body: string;
  inputs: WorkflowV2Binding[];
}
export type WorkflowV2Step =
  | AgentWorkflowV2Step
  | CouncilWorkflowV2Step
  | ApprovalWorkflowV2Step
  | ChecklistWorkflowV2Step
  | MessageWorkflowV2Step;
export interface WorkflowV2Definition {
  format: "coforge-workflow/v2";
  revision: string;
  name: string;
  subjectMode: "note" | "idea";
  teamId: string;
  limits: {
    timeoutSeconds: number;
    maxTurns: number;
    maxBudgetUsd: number;
    maxInvocations: number;
  };
  collections: { id: string; producers: string[] }[];
  steps: WorkflowV2Step[];
}
const id = workflowIdCheck;
function bindingCheck(value: unknown): WorkflowV2Binding {
  const kind = record(value).kind;
  if (kind === "producer")
    return shape(
      { kind: oneOf(["producer"] as const), stepId: id },
      { strict: true },
    )(value);
  if (kind === "artifact")
    return shape(
      {
        kind: oneOf(["artifact"] as const),
        producerStepId: id,
        artifactId: text({ min: 1, max: 200 }),
      },
      { strict: true },
    )(value);
  return shape(
    { kind: oneOf(["collection"] as const), collectionId: id },
    { strict: true },
  )(value);
}
const base = {
  id,
  name: text({ min: 1, max: 100, trim: true }),
  instructions: text({ max: 16000 }),
};
const inputs = list(bindingCheck, { max: 100 });
function stepCheck(value: unknown): WorkflowV2Step {
  const kind = record(value).kind;
  if (kind === "agent")
    return shape(
      {
        ...base,
        kind: oneOf(["agent"] as const),
        agentId: id,
        output: oneOf(["markdown", "plan"] as const),
        access: oneOf(["none"] as const),
        inputs,
      },
      { strict: true },
    )(value);
  if (kind === "council")
    return shape(
      { ...base, kind: oneOf(["council"] as const), councilId: id, inputs },
      { strict: true },
    )(value);
  if (kind === "message")
    return shape(
      {
        ...base,
        kind: oneOf(["message"] as const),
        purpose: oneOf(["information", "request"] as const),
        recipientId: id,
        body: text({ min: 1, max: 16000 }),
        inputs,
      },
      { strict: true },
    )(value);
  if (kind === "approval")
    return shape(
      { ...base, kind: oneOf(["approval"] as const) },
      { strict: true },
    )(value);
  return shape(
    {
      ...base,
      kind: oneOf(["checklist"] as const),
      items: list(
        shape(
          { id, label: text({ min: 1, max: 500 }), required: boolean },
          { strict: true },
        ),
        { min: 1, max: 40 },
      ),
    },
    { strict: true },
  )(value);
}
const definitionCheck = shape(
  {
    format: oneOf(["coforge-workflow/v2"] as const),
    revision: id,
    name: text({ min: 1, max: 100, trim: true }),
    subjectMode: oneOf(["note", "idea"] as const),
    teamId: id,
    limits: shape(
      {
        timeoutSeconds: number({ min: 15, max: 1800, integer: true }),
        maxTurns: number({ min: 1, max: 50, integer: true }),
        maxBudgetUsd: number({ min: 0.1, max: 20 }),
        maxInvocations: number({ min: 1, max: 100, integer: true }),
      },
      { strict: true },
    ),
    collections: list(
      shape({ id, producers: list(id, { min: 1, max: 40 }) }, { strict: true }),
      { max: 40 },
    ),
    steps: list(stepCheck, { min: 1, max: 40 }),
  },
  { strict: true },
);
export function workflowV2DefinitionCheck(
  value: unknown,
): WorkflowV2Definition {
  const definition = definitionCheck(value);
  if (
    new Set(definition.steps.map((step) => step.id)).size !==
      definition.steps.length ||
    new Set(definition.collections.map((collection) => collection.id)).size !==
      definition.collections.length
  )
    throw new Error("Workflow step and collection IDs must be unique.");
  for (const collection of definition.collections)
    if (
      new Set(collection.producers).size !== collection.producers.length ||
      collection.producers.some(
        (producer) =>
          !definition.steps.some(
            (step) =>
              step.id === producer && ["agent", "council"].includes(step.kind),
          ),
      )
    )
      throw new Error("Collection producers must be unique executable steps.");
  const earlier = new Set<string>();
  for (const step of definition.steps) {
    if (
      step.kind === "checklist" &&
      new Set(step.items.map((item) => item.id)).size !== step.items.length
    )
      throw new Error("Checklist item IDs must be unique.");
    if (
      step.kind === "agent" ||
      step.kind === "council" ||
      step.kind === "message"
    ) {
      for (const binding of step.inputs) {
        const producers = workflowV2BindingProducers(definition, binding);
        if (producers.some((producer) => !earlier.has(producer)))
          throw new Error(
            "Bindings may select only earlier executable producers.",
          );
      }
      if (step.kind !== "message") earlier.add(step.id);
    }
  }
  return definition;
}
export function workflowV2BindingProducers(
  definition: WorkflowV2Definition,
  binding: WorkflowV2Binding,
): string[] {
  if (binding.kind === "producer") return [binding.stepId];
  if (binding.kind === "artifact") return [binding.producerStepId];
  const collection = definition.collections.find(
    (item) => item.id === binding.collectionId,
  );
  if (!collection)
    throw new Error("The named input collection is unavailable.");
  return [...collection.producers];
}
export function parseWorkflowV2Definition(value: string): WorkflowV2Definition {
  if (value.length > 400000)
    throw new Error("The workflow import exceeds its size limit.");
  return workflowV2DefinitionCheck(JSON.parse(value));
}
