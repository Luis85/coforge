import { describe, expect, it } from "vitest";
import { ExecutionKernel } from "../../../features/coforge/application/execution-kernel";
import { compileWorkflowV2 } from "../../../features/coforge/application/workflow-v2-compiler";
import {
  decodeWorkflowV2Plan,
  workflowV2Admission,
  workflowV2Dispatch,
} from "../../../features/coforge/application/workflow-v2-execution";
import type { WorkflowV2Preview } from "../../../features/coforge/application/workflow-v2-ports";
import {
  defaultCouncilDefinition,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
import { emptyExecutionJournal } from "../../../features/coforge/domain/execution-run";

const agent: AgentDefinition = {
  schema: "agent/v1",
  id: "reviewer",
  name: "Reviewer",
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
  projectId: "CFP-001",
  members: [agent.id],
  pinnedContext: [],
  recentMessages: 10,
  allowedRecipients: [],
};
function preview(): WorkflowV2Preview {
  const subject = {
    kind: "note" as const,
    sourceId: "source",
    revision: "r1",
    markdown: "Proposal",
  };
  const council = defaultCouncilDefinition("council", "Council", team, [
    agent.id,
  ]);
  const plan = compileWorkflowV2(
    {
      format: "coforge-workflow/v2",
      revision: "v2-1",
      name: "Discuss",
      subjectMode: "note",
      teamId: team.id,
      limits: {
        timeoutSeconds: 180,
        maxBudgetUsd: 1,
        maxTurns: 12,
        maxInvocations: 10,
      },
      collections: [],
      steps: [
        {
          kind: "council",
          id: "discuss",
          name: "Discuss",
          instructions: "Evaluate proposal",
          councilId: council.id,
          inputs: [],
        },
        {
          kind: "approval",
          id: "review",
          name: "Review",
          instructions: "Choose direction",
        },
        {
          kind: "agent",
          id: "summarize",
          name: "Summarize",
          instructions: "Respect disagreement",
          agentId: agent.id,
          output: "markdown",
          access: "none",
          inputs: [{ kind: "producer", stepId: "discuss" }],
        },
      ],
    },
    subject,
    { projectId: team.projectId, team, agents: [agent], councils: [council] },
  );
  return {
    plan,
    source: {
      sourceId: subject.sourceId,
      revision: subject.revision,
      generation: 0,
      markdown: subject.markdown,
    },
    invocations: plan.invocations.length,
    context: "",
    warnings: [],
  };
}
describe("workflow v2 shared execution", () => {
  it("pins reusable definitions, publishes both council rounds, releases a manual checkpoint and returns typed council results", async () => {
    let journal = emptyExecutionJournal();
    const prompts: string[] = [];
    let ids = 0;
    const kernel = new ExecutionKernel({
      journal: {
        load: async () => journal,
        save: async (value) => {
          journal = structuredClone(value);
        },
      },
      now: () => "2026-10-28T12:00:00.000Z",
      id: () => `attempt-${++ids}`,
      assertEligible: async () => undefined,
      resolveInvocation: workflowV2Dispatch,
      invoke: async (run, invocation, attempt) => {
        prompts.push(attempt.dispatch.prompt);
        return { markdown: `Contribution ${invocation.id}`, simulated: true };
      },
      publish: async () => undefined,
    });
    await kernel.load();
    const source = preview();
    await kernel.admit(workflowV2Admission(source, "run", "submission", true));
    source.plan.catalogue.agents[0]!.instructions = "Changed";
    kernel.resume();
    expect(
      decodeWorkflowV2Plan(kernel.snapshot().runs[0]!).invocations[0]
        ?.instructions,
    ).toContain("Analyze");
    await kernel.step("run");
    await kernel.step("run");
    await kernel.step("run");
    expect(kernel.snapshot().runs[0]?.state).toBe("waiting-human");
    expect(prompts).toHaveLength(2);
    await kernel.acknowledgeCheckpoint(
      "run",
      "review",
      [],
      "Use proposal B, preserving the accessibility constraints.",
    );
    await kernel.step("run");
    expect(kernel.snapshot().runs[0]?.state).toBe("completed");
    expect(JSON.parse(prompts[2]!)).toMatchObject({
      councilResults: [
        {
          opinions: [expect.objectContaining({ agentId: "reviewer" })],
          solutions: [expect.objectContaining({ agentId: "reviewer" })],
          dissent: {
            status: "not-inferred",
            evidenceArtifactIds: [expect.any(String), expect.any(String)],
          },
          sourceLinks: [
            {
              sourceId: "source",
              sourceRevision: "r1",
              artifactIds: [expect.any(String), expect.any(String)],
            },
          ],
        },
      ],
    });
    expect(JSON.parse(prompts[2]!)).toMatchObject({
      humanDecisions: [
        expect.objectContaining({
          checkpointId: "review",
          note: "Use proposal B, preserving the accessibility constraints.",
          authority: "checkpoint-only",
        }),
      ],
    });
    expect(JSON.parse(prompts[0]!).humanDecisions).toEqual([]);
  });
});
