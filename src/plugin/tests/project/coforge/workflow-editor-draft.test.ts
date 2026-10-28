import { expect, it } from "vitest";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import {
  duplicateWorkflowStep,
  moveWorkflowStep,
} from "../../../presentation/stores/workflow-editor-draft";
it("reorders stable step identities and duplicates checklist items with independent new identities", () => {
  const definition = defaultWorkflowDefinition(defaultSettings());
  const first = definition.steps[0]!.id;
  moveWorkflowStep(definition, first, 1);
  expect(definition.steps[1]!.id).toBe(first);
  definition.steps.push({
    id: "manual",
    name: "Human check",
    instructions: "Review the work",
    kind: "checklist",
    items: [{ id: "item", label: "Inspect the changes", required: true }],
  });
  const copy = duplicateWorkflowStep(definition, "manual");
  expect(copy?.id).not.toBe("manual");
  expect(copy?.kind).toBe("checklist");
  if (copy?.kind !== "checklist")
    throw new Error("Checklist duplicate missing");
  expect(copy.items[0]!.id).not.toBe("item");
  copy.items[0]!.label = "Changed copy";
  const original = definition.steps.find((step) => step.id === "manual");
  expect(original?.kind === "checklist" && original.items[0]!.label).toBe(
    "Inspect the changes",
  );
});
