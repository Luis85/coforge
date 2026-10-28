import { expect, it } from "vitest";
import {
  defaultCouncilDefinition,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
import { compileCouncil } from "../../../features/coforge/domain/council-protocol";
import { compileWorkflowV2 } from "../../../features/coforge/application/workflow-v2-compiler";
import type { CouncilPreflight } from "../../../features/coforge/application/council-execution";
import type { WorkflowV2Preview } from "../../../features/coforge/application/workflow-v2-ports";
import {
  reviewedCouncilIdentity,
  reviewedWorkflowIdentity,
  assertReviewedCouncilIdentity,
  assertReviewedWorkflowIdentity,
} from "../../../features/coforge/application/reviewed-preflight";

const agent: AgentDefinition = {
  schema: "agent/v1",
  id: "architect",
  name: "Architect",
  enabled: true,
  role: "Architecture",
  instructions: "Inspect boundaries.",
  provider: "demo",
  model: "sonnet",
  contextSources: [],
  requestedCapabilities: { project: "none", messaging: false },
};
const team: TeamDefinition = {
  schema: "team/v1",
  id: "team-one",
  name: "Team",
  enabled: true,
  projectId: "CFP-001",
  members: [agent.id],
  pinnedContext: [],
  recentMessages: 10,
  allowedRecipients: [],
};
function council(): CouncilPreflight {
  return {
    plan: compileCouncil(
      defaultCouncilDefinition("council-one", "Council", team, team.members),
      team,
      [agent],
    ),
    source: {
      sourceId: "unassigned",
      revision: "source-revision",
      generation: 0,
      markdown: "The original input.",
    },
    context: "Captured context.",
    invocations: 2,
    warnings: [],
  };
}
function workflow(): WorkflowV2Preview {
  const source = council().source;
  const plan = compileWorkflowV2(
    {
      format: "coforge-workflow/v2",
      revision: "v2-one",
      name: "Analytical workflow",
      subjectMode: "note",
      teamId: team.id,
      limits: {
        timeoutSeconds: 180,
        maxTurns: 12,
        maxBudgetUsd: 1,
        maxInvocations: 24,
      },
      collections: [],
      steps: [
        {
          id: "analysis",
          kind: "agent",
          name: "Analyze",
          instructions: "Read carefully.",
          agentId: agent.id,
          output: "markdown",
          access: "none",
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
    { projectId: team.projectId, team, agents: [agent], councils: [] },
  );
  return {
    plan,
    source,
    context: "Captured context.",
    invocations: 1,
    warnings: [],
  };
}
it("binds Council admission to the exact reviewed source, generation, provider, definitions and context", () => {
  const preview = council();
  const expected = reviewedCouncilIdentity(preview);
  const assigned = structuredClone(preview);
  assigned.source.sourceId = "new-host-assigned-id";
  expect(reviewedCouncilIdentity(assigned)).toBe(expected);
  for (const changed of [
    () => {
      const value = council();
      value.source.markdown = "Changed input.";
      return value;
    },
    () => {
      const value = council();
      value.source.generation++;
      return value;
    },
    () => {
      const value = council();
      value.context = "New team information.";
      return value;
    },
    () => {
      const value = council();
      value.projectPrompt = "Changed host project guidance.";
      return value;
    },
    () => {
      const value = council();
      value.plan.invocations[0]!.agent.provider = "claude";
      return value;
    },
    () => {
      const value = council();
      value.plan.definition.rounds[0]!.instructions = "Changed round.";
      return value;
    },
  ])
    expect(() => assertReviewedCouncilIdentity(changed(), expected)).toThrow(
      /preflight again/i,
    );
});
it("applies the same freshness rule to v2 workflows while excluding newly assigned source identity", () => {
  const preview = workflow();
  const expected = reviewedWorkflowIdentity(preview);
  const assigned = structuredClone(preview);
  assigned.source.sourceId = "new-host-assigned-id";
  assigned.plan.subject.sourceId = assigned.source.sourceId;
  expect(reviewedWorkflowIdentity(assigned)).toBe(expected);
  const sourceChanged = workflow();
  sourceChanged.source.revision = "new-source-revision";
  const modelChanged = workflow();
  modelChanged.plan.catalogue.agents[0]!.model = "opus";
  const contextChanged = workflow();
  contextChanged.context += " New context.";
  for (const changed of [sourceChanged, modelChanged, contextChanged])
    expect(() => assertReviewedWorkflowIdentity(changed, expected)).toThrow(
      /preflight again/i,
    );
});
