import { expect, it } from "vitest";
import {
  councilDefinitionCheck,
  definitionRevision,
} from "../../../features/coforge/domain/council-definitions";
import {
  councilInvocationInputs,
  type CouncilContribution,
} from "../../../features/coforge/domain/council-protocol";
import {
  councilAdmission,
  decodeCouncilPlan,
} from "../../../features/coforge/application/council-execution";
import { executionAdmissionCheck } from "../../../features/coforge/domain/execution-run";
import { reviewedCouncilIdentity } from "../../../features/coforge/application/reviewed-preflight";
import { compileWorkflowV2 } from "../../../features/coforge/application/workflow-v2-compiler";
import {
  workflowV2Admission,
  decodeWorkflowV2Plan,
} from "../../../features/coforge/application/workflow-v2-execution";
import {
  readCouncilDefinitionNote,
  writeCouncilDefinitionNote,
} from "../../../infrastructure/coforge/council-definition-notes";
import {
  promptOrderAgents,
  promptOrderDefinition,
  promptOrderPreview,
  promptOrderRun,
  promptOrderTeam,
} from "./council-prompt-order-fixture";

const limits = {
  timeoutSeconds: 180,
  maxTurns: 12,
  maxBudgetUsd: 1,
  simulation: true,
};

it("preserves absent legacy mode and captures each explicitly chosen round's prompt order", () => {
  const definition = promptOrderDefinition();
  const legacy = JSON.stringify(definition);
  expect(JSON.stringify(councilDefinitionCheck(JSON.parse(legacy)))).toBe(
    legacy,
  );
  const oldPreview = promptOrderPreview(definition);
  const oldRun = promptOrderRun(
    councilAdmission(oldPreview, "old", "old-key", limits),
  );
  expect(oldRun.invocations.every((item) => !("promptOrder" in item))).toBe(
    true,
  );
  definition.rounds[0]!.promptOrder = "fan-out";
  definition.rounds[1]!.promptOrder = "round-robin";
  const preview = promptOrderPreview(definition);
  const run = promptOrderRun(
    councilAdmission(preview, "new", "new-key", limits),
  );
  expect(run.invocations.map((item) => item.promptOrder)).toEqual([
    "fan-out",
    "fan-out",
    "round-robin",
    "round-robin",
  ]);
  expect(reviewedCouncilIdentity(preview)).not.toBe(
    reviewedCouncilIdentity(oldPreview),
  );
  expect(preview.plan.definitionRevision).not.toBe(
    definitionRevision(JSON.parse(legacy)),
  );
  definition.rounds[0]!.promptOrder = "round-robin";
  expect(decodeCouncilPlan(run).definition.rounds[0]!.promptOrder).toBe(
    "fan-out",
  );
  expect(
    decodeCouncilPlan(oldRun).invocations.every(
      (item) => !("promptOrder" in item),
    ),
  ).toBe(true);
});

it("rejects unsupported round modes and captures the new mode in canonical notes", () => {
  const definition = promptOrderDefinition();
  expect(() =>
    councilDefinitionCheck({
      ...definition,
      rounds: [{ ...definition.rounds[0], promptOrder: "parallel" }],
    }),
  ).toThrow();
  definition.rounds[0]!.promptOrder = "fan-out";
  const original =
    '---\nowner: "keep exact" # annotation\n---\nHuman notes stay.\r\n';
  const written = writeCouncilDefinitionNote(original, definition);
  const read = readCouncilDefinitionNote(written);
  expect(read.schema === "council/v1" && read.rounds[0]?.promptOrder).toBe(
    "fan-out",
  );
  expect(written).toContain('owner: "keep exact" # annotation');
  expect(written).toContain("Human notes stay.\r\n");
});

it("keeps opinion independence and the sealed earlier-round barrier in fan-out mode", () => {
  const definition = promptOrderDefinition();
  definition.rounds[0]!.promptOrder = "fan-out";
  definition.rounds[1]!.promptOrder = "fan-out";
  const { plan } = promptOrderPreview(definition);
  const contributions: CouncilContribution[] = plan.invocations
    .slice(0, 2)
    .map((item, index) => ({
      invocationId: item.id,
      artifactId: `artifact-${index}`,
      attemptId: `attempt-${index}`,
      markdown: `Opinion ${index}`,
      timestamp: "2026-10-28T12:00:00Z",
      status: "succeeded",
      provider: "demo",
      model: "sonnet",
    }));
  expect(
    councilInvocationInputs(plan, plan.invocations[1]!.id, contributions),
  ).toEqual([]);
  expect(() =>
    councilInvocationInputs(
      plan,
      plan.invocations[2]!.id,
      contributions.slice(0, 1),
    ),
  ).toThrow(/incomplete/iu);
  expect(
    councilInvocationInputs(
      plan,
      plan.invocations[2]!.id,
      [...contributions].reverse(),
    ).map((item) => item.artifactId),
  ).toEqual(["artifact-0", "artifact-1"]);
});

it("pins prompt order through the journal check and rejects a journal mode that differs from its captured definition", () => {
  const definition = promptOrderDefinition();
  definition.rounds[0]!.promptOrder = "fan-out";
  const admission = councilAdmission(
    promptOrderPreview(definition),
    "new",
    "new-key",
    limits,
  );
  expect(executionAdmissionCheck(admission).invocations[0]?.promptOrder).toBe(
    "fan-out",
  );
  expect(() =>
    executionAdmissionCheck({
      ...admission,
      invocations: [{ ...admission.invocations[0], promptOrder: "parallel" }],
    }),
  ).toThrow();
  const run = promptOrderRun(admission);
  run.invocations[0]!.promptOrder = "round-robin";
  expect(() => decodeCouncilPlan(run)).toThrow(/captured.*prompt order/iu);
});

it("propagates council modes through explicit v2 expansion without changing ordinary agent steps", () => {
  const council = promptOrderDefinition();
  council.rounds[0]!.promptOrder = "fan-out";
  const source = promptOrderPreview().source;
  const plan = compileWorkflowV2(
    {
      format: "coforge-workflow/v2",
      revision: "v2-one",
      name: "Proposal",
      subjectMode: "note",
      teamId: promptOrderTeam.id,
      limits: {
        timeoutSeconds: 180,
        maxTurns: 12,
        maxBudgetUsd: 1,
        maxInvocations: 10,
      },
      collections: [],
      steps: [
        {
          id: "advice",
          name: "Council",
          instructions: "Discuss",
          kind: "council",
          councilId: council.id,
          inputs: [],
        },
        {
          id: "summary",
          name: "Summary",
          instructions: "Summarize",
          kind: "agent",
          agentId: promptOrderAgents[0]!.id,
          access: "none",
          output: "markdown",
          inputs: [],
        },
      ],
    },
    {
      kind: "note",
      sourceId: source.sourceId,
      revision: source.revision,
      markdown: source.markdown,
    },
    {
      projectId: promptOrderTeam.projectId,
      team: promptOrderTeam,
      agents: promptOrderAgents,
      councils: [council],
    },
  );
  expect(plan.invocations.slice(0, 2).map((item) => item.promptOrder)).toEqual([
    "fan-out",
    "fan-out",
  ]);
  expect(plan.invocations.at(-1)).not.toHaveProperty("promptOrder");
  const run = promptOrderRun(
    workflowV2Admission(
      {
        plan,
        source,
        context: "Shared",
        invocations: plan.invocations.length,
        warnings: [],
      },
      "v2",
      "v2-key",
      true,
    ),
  );
  council.rounds[0]!.promptOrder = "round-robin";
  expect(decodeWorkflowV2Plan(run).invocations[0]?.promptOrder).toBe("fan-out");
  run.invocations[0]!.promptOrder = "round-robin";
  expect(() => decodeWorkflowV2Plan(run)).toThrow(/captured.*prompt order/iu);
});
