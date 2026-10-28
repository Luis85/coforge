import { describe, expect, it } from "vitest";
import {
  agentDefinitionCheck,
  councilDefinitionCheck,
  defaultCouncilDefinition,
  definitionRevision,
  teamDefinitionCheck,
} from "../../../features/coforge/domain/council-definitions";
import {
  compileCouncil,
  councilInvocationInputs,
  councilResult,
  type CouncilContribution,
} from "../../../features/coforge/domain/council-protocol";

const agents = ["product", "architect", "qa"].map((id) =>
  agentDefinitionCheck({
    schema: "agent/v1",
    id,
    name: id,
    enabled: true,
    role: id,
    instructions: `Act as ${id}`,
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  }),
);
const team = teamDefinitionCheck({
  schema: "team/v1",
  id: "team-studio",
  name: "Studio",
  enabled: true,
  projectId: "CFP-001",
  members: agents.map((a) => a.id),
  pinnedContext: [],
  recentMessages: 10,
  allowedRecipients: [],
});
const definition = () =>
  defaultCouncilDefinition(
    "design",
    "Design council",
    team,
    agents.map((a) => a.id),
  );
const contribution = (
  invocationId: string,
  index: number,
): CouncilContribution => ({
  invocationId,
  artifactId: `artifact-${index}`,
  attemptId: `attempt-${index}`,
  markdown: `Answer ${index}`,
  timestamp: "2026-10-28T12:00:00Z",
  status: "succeeded",
  provider: "demo",
  model: "sonnet",
});

describe("council protocol expansion and immutable explicit bindings", () => {
  it("expands three independent opinions before three solutions and retains every opinion", () => {
    const plan = compileCouncil(definition(), team, agents);
    expect(plan.invocations.map((i) => `${i.roundId}/${i.agent.id}`)).toEqual([
      "opinions/product",
      "opinions/architect",
      "opinions/qa",
      "solutions/product",
      "solutions/architect",
      "solutions/qa",
    ]);
    const saved = plan.invocations
      .slice(0, 3)
      .map((i, n) => contribution(i.id, n));
    expect(
      councilInvocationInputs(plan, plan.invocations[1]!.id, saved),
    ).toEqual([]);
    expect(
      councilInvocationInputs(plan, plan.invocations[3]!.id, saved).map(
        (a) => a.artifactId,
      ),
    ).toEqual(["artifact-0", "artifact-1", "artifact-2"]);
    expect(
      councilInvocationInputs(plan, plan.invocations[4]!.id, [
        ...saved,
        contribution(plan.invocations[3]!.id, 3),
      ]).map((a) => a.artifactId),
    ).toEqual(["artifact-0", "artifact-1", "artifact-2"]);
    agents[0]!.instructions = "Future edit";
    expect(plan.invocations[0]!.agent.instructions).toBe("Act as product");
    agents[0]!.instructions = "Act as product";
  });

  it("blocks dependent rounds until required results exist and enforces partial minimums", () => {
    const council = definition();
    const plan = compileCouncil(council, team, agents);
    expect(() =>
      councilInvocationInputs(plan, plan.invocations[3]!.id, []),
    ).toThrow(/incomplete/i);
    council.rounds[0]!.completion = { kind: "partial", minimum: 2 };
    const partial = compileCouncil(council, team, agents);
    const saved = partial.invocations
      .slice(0, 2)
      .map((i, n) => contribution(i.id, n));
    saved.push({
      ...contribution(partial.invocations[2]!.id, 2),
      status: "skipped",
      markdown: "",
      reason: "Operator skipped unavailable member",
    });
    expect(
      councilInvocationInputs(partial, partial.invocations[3]!.id, saved),
    ).toHaveLength(3);
    expect(() =>
      councilInvocationInputs(
        partial,
        partial.invocations[3]!.id,
        saved.slice(0, 1),
      ),
    ).toThrow(/incomplete/i);
  });

  it("rejects forward references, duplicate members, foreign agents, unknown schema fields and impossible budgets", () => {
    const council = definition();
    council.rounds.reverse();
    expect(() => councilDefinitionCheck(council)).toThrow(/earlier/i);
    expect(() =>
      councilDefinitionCheck({
        ...definition(),
        members: ["product", "product"],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      compileCouncil(definition(), { ...team, members: ["product"] }, agents),
    ).toThrow(/team/i);
    expect(() =>
      agentDefinitionCheck({ ...agents[0], secret: "not allowed" }),
    ).toThrow(/not allowed/i);
    expect(() =>
      compileCouncil(
        {
          ...definition(),
          limits: { ...definition().limits, maxInvocations: 5 },
        },
        team,
        agents,
      ),
    ).toThrow(/invocation/i);
  });
  it("rejects oversized assembled instructions during preflight rather than after submission", () => {
    const oversized = structuredClone(agents);
    oversized[0]!.instructions = "A".repeat(15900);
    const council = definition();
    council.rounds[0]!.instructions = "B".repeat(200);
    expect(() => compileCouncil(council, team, oversized)).toThrow(
      /instruction.*limit/i,
    );
  });
  it("keeps legacy Markdown defaults and captures an explicitly selected validated-plan contract", () => {
    const agent = agentDefinitionCheck({
      ...agents[0]!,
      outputDefault: "plan",
    });
    expect(agent.outputDefault).toBe("plan");
    const council = definition();
    council.rounds[0]!.output = "plan";
    expect(
      compileCouncil(council, team, [agent, ...agents.slice(1)]).invocations[0]!
        .output,
    ).toBe("plan");
    expect(definition().rounds.map((round) => round.output)).toEqual([
      "markdown",
      "markdown",
    ]);
  });

  it("requires a validated typed plan for plan-contract contributions and retains it in bound collections", () => {
    const council = definition();
    council.rounds[0]!.output = "plan";
    const plan = compileCouncil(council, team, agents);
    const saved = plan.invocations
      .slice(0, 3)
      .map((invocation, index) => contribution(invocation.id, index));
    expect(() =>
      councilInvocationInputs(plan, plan.invocations[3]!.id, saved),
    ).toThrow(/validated.*plan/i);
    const typed = saved.map((item) => ({
      ...item,
      plan: {
        summary: "A bounded proposal",
        steps: ["Implement the lantern"],
        acceptanceCriteria: ["The path stays readable"],
        risks: [],
        markdown: item.markdown,
        createdAt: item.timestamp,
      },
    }));
    expect(
      councilInvocationInputs(plan, plan.invocations[3]!.id, typed)[0]!.plan
        ?.summary,
    ).toBe("A bounded proposal");
  });

  it("pins revisions and emits attributed result collections, with synthesis additional to solutions", () => {
    const council = definition();
    council.rounds.push({
      id: "chair",
      name: "Chair synthesis",
      kind: "synthesis",
      participants: ["architect"],
      instructions: "Preserve disagreements.",
      inputs: ["opinions", "solutions"],
      output: "markdown",
      access: "none",
      completion: { kind: "all" },
    });
    const plan = compileCouncil(council, team, agents);
    const saved = plan.invocations.map((i, n) => contribution(i.id, n));
    const result = councilResult(plan, saved);
    expect(result.opinions).toHaveLength(3);
    expect(result.solutions).toHaveLength(3);
    expect(result.synthesis).toHaveLength(1);
    expect(result.status).toBe("completed");
    expect(result.opinions[0]).toMatchObject({
      agentId: "product",
      agentRevision: definitionRevision(agents[0]!),
      roundId: "opinions",
    });
    expect(
      definitionRevision({ ...agents[0]!, instructions: "Changed" }),
    ).not.toBe(definitionRevision(agents[0]!));
  });
});
