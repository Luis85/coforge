import { expect, it } from "vitest";
import { compileWorkflowV2 } from "../../../features/coforge/application/workflow-v2-compiler";
import {
  decodeWorkflowV2Plan,
  encodeWorkflowV2Plan,
} from "../../../features/coforge/application/workflow-v2-execution";
import {
  defaultCouncilDefinition,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
import type { WorkflowV2Definition } from "../../../features/coforge/domain/configured-workflow-v2";

const agent: AgentDefinition = {
  schema: "agent/v1",
  id: "analyst",
  name: "Analyst",
  enabled: true,
  role: "Review",
  instructions: "Analyze",
  provider: "demo",
  model: "sonnet",
  contextSources: [],
  requestedCapabilities: { project: "none", messaging: false },
};
const team: TeamDefinition = {
  schema: "team/v1",
  id: "team",
  name: "Team",
  enabled: true,
  projectId: "project",
  members: ["analyst"],
  pinnedContext: [],
  recentMessages: 10,
  allowedRecipients: [],
};
const subject = {
  kind: "note" as const,
  sourceId: "note",
  revision: "r1",
  markdown: "Proposal",
};
const template = {
  id: "answer",
  projectId: "project",
  name: "Decision",
  markdown: "# Decision\n\n## Evidence",
  revision: "template-r1",
};
const definition: WorkflowV2Definition = {
  format: "coforge-workflow/v2",
  revision: "v2",
  name: "Review",
  subjectMode: "note",
  teamId: "team",
  limits: {
    timeoutSeconds: 180,
    maxTurns: 12,
    maxBudgetUsd: 1,
    maxInvocations: 20,
  },
  collections: [],
  steps: [
    {
      kind: "agent",
      id: "analysis",
      name: "Analyze",
      instructions: "Review source",
      agentId: "analyst",
      output: "markdown",
      access: "none",
      inputs: [],
      outputTemplateId: "answer",
    },
    {
      kind: "council",
      id: "council",
      name: "Council",
      instructions: "Discuss",
      councilId: "design",
      inputs: [],
      outputTemplateId: "answer",
    },
  ],
};
function catalogue() {
  return {
    projectId: "project",
    team,
    agents: [agent],
    councils: [defaultCouncilDefinition("design", "Design", team, ["analyst"])],
    outputTemplates: [structuredClone(template)],
  };
}

it("pins project Markdown guidance for agent and council steps and reconstructs it without reading mutable notes", () => {
  const source = catalogue();
  const plan = compileWorkflowV2(definition, subject, source);
  expect(
    plan.invocations.every((item) =>
      item.instructions.includes(template.markdown),
    ),
  ).toBe(true);
  expect(plan.invocations.every((item) => item.access === "none")).toBe(true);
  source.outputTemplates[0]!.markdown = "# Changed";
  const decoded = decodeWorkflowV2Plan({
    definitionSnapshot: encodeWorkflowV2Plan(plan),
    subject,
    projectId: "project",
  });
  expect(decoded.invocations[0]?.instructions).toContain("# Decision");
  expect(decoded.invocations[0]?.instructions).not.toContain("# Changed");
  expect(decoded.catalogue.outputTemplates).toEqual([template]);
});

it("rejects missing/cross-project snapshots and assembled prompts above the immutable limit", () => {
  expect(() =>
    compileWorkflowV2(definition, subject, {
      ...catalogue(),
      outputTemplates: [],
    }),
  ).toThrow(/template/i);
  expect(() =>
    compileWorkflowV2(definition, subject, {
      ...catalogue(),
      outputTemplates: [{ ...template, projectId: "other" }],
    }),
  ).toThrow(/template/i);
  const oversized = structuredClone(definition);
  oversized.steps[0]!.instructions = "x".repeat(15000);
  expect(() =>
    compileWorkflowV2(oversized, subject, {
      ...catalogue(),
      outputTemplates: [{ ...template, markdown: "x".repeat(8000) }],
    }),
  ).toThrow(/allowance/i);
});
