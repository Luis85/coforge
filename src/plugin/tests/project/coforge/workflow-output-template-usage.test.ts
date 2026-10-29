import { expect, it, vi } from "vitest";
import { withWorkflowOutputTemplateUsage } from "../../../features/coforge/application/workflow-output-template-usage";
import { createOutputTemplatesPreview } from "../../../../../harness/prototype/output-templates-preview";
import { ai, definition } from "./configured-workflow-fixture";
import type { WorkflowV2Definition } from "../../../features/coforge/domain/configured-workflow-v2";

it("reports saved request and proposal step dependencies without reading template contents or changing definitions", async () => {
  const request = definition([
    { ...ai("report"), name: "Write report", outputTemplateId: "answer" },
    { ...ai("copy"), name: "Second report", outputTemplateId: "answer" },
    { id: 'ask-request', kind: 'council', name: 'Request Council', instructions: 'Review the request.', councilId: 'answer', contextMode: 'none', automatic: false },
  ]);
  const proposal: WorkflowV2Definition = {
    format: "coforge-workflow/v2",
    revision: "proposal-r1",
    name: "Council review",
    teamId: "team",
    subjectMode: "note",
    limits: {
      timeoutSeconds: 180,
      maxTurns: 12,
      maxBudgetUsd: 1,
      maxInvocations: 12,
    },
    collections: [],
    steps: [
      { kind: 'agent', id: 'prepare', name: 'Prepare proposal', instructions: 'Prepare', agentId: 'agent', access: 'none', inputs: [], output: 'markdown', outputTemplateId: 'answer' },
      {
        kind: "council",
        id: "review",
        name: "Review together",
        instructions: "Review",
        councilId: "council",
        inputs: [],
        outputTemplateId: "answer",
      },
    ],
  };
  const source = createOutputTemplatesPreview(() => undefined);
  const list = vi.spyOn(source, "list");
  const save = vi.spyOn(source, "save");
  const read = vi.fn(async () => ({ request, proposal }));
  const actions = withWorkflowOutputTemplateUsage(source, read);
  const usage = await actions.references?.("CFP-001", "answer");
  expect(usage?.references).toEqual([
    {
      workflow: "request",
      workflowName: request.name,
      stepId: "report",
      stepName: "Write report",
    },
    {
      workflow: "request",
      workflowName: request.name,
      stepId: "copy",
      stepName: "Second report",
    },
    {
      workflow: "proposal",
      workflowName: "Council review",
      stepId: "prepare",
      stepName: "Prepare proposal",
    },
    {
      workflow: "proposal",
      workflowName: "Council review",
      stepId: "review",
      stepName: "Review together",
    },
  ]);
  expect(usage?.unavailable).toBeUndefined();
  expect(list).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  request.steps.reverse();
  expect(
    (await actions.references?.("CFP-001", "answer"))?.references.map(
      (item) => item.stepId,
    ),
  ).toEqual(["copy", "report", "prepare", "review"]);
  const partial = {
    request,
    proposal,
    unavailable: "Proposal references need repair.",
  };
  read.mockResolvedValueOnce(partial);
  expect((await actions.references?.("CFP-001", "answer"))?.unavailable).toBe(
    "Proposal references need repair.",
  );
});
