import {
  agentDefinitionCheck,
  councilDefinitionCheck,
  definitionRevision,
  teamDefinitionCheck,
  type AgentDefinition,
  type CouncilDefinition,
  type CouncilRound,
  type TeamDefinition,
} from "./council-definitions";
import type { Provider, ImplementationPlan } from "./types";
import { workflowPlanCheck } from "./configured-workflow-run";

export interface CouncilInvocation {
  id: string;
  roundId: string;
  roundName: string;
  kind: CouncilRound["kind"];
  agent: AgentDefinition;
  agentRevision: string;
  instructions: string;
  inputs: string[];
  access: "none";
  output: "markdown" | "plan";
  projectId: string;
  teamId: string;
}
export interface CouncilPlan {
  targetKind?: "agent" | "council";
  definition: CouncilDefinition;
  definitionRevision: string;
  team: TeamDefinition;
  teamRevision: string;
  invocations: CouncilInvocation[];
}
export interface CouncilContribution {
  invocationId: string;
  artifactId: string;
  attemptId: string;
  markdown: string;
  timestamp: string;
  status: "succeeded" | "skipped";
  provider: Provider;
  model: string;
  reason?: string;
  plan?: ImplementationPlan;
}
export interface AttributedCouncilContribution extends CouncilContribution {
  agentId: string;
  agentName: string;
  agentRevision: string;
  roundId: string;
  roundName: string;
}
export interface CouncilResult {
  definitionId: string;
  definitionRevision: string;
  status: "completed" | "completed-with-gaps";
  opinions: AttributedCouncilContribution[];
  solutions: AttributedCouncilContribution[];
  synthesis: AttributedCouncilContribution[];
  missing: AttributedCouncilContribution[];
  dissent: { status: "not-inferred"; evidenceArtifactIds: string[] };
  sourceLinks: {
    sourceId: string;
    sourceRevision: string;
    artifactIds: string[];
  }[];
}

export function compileCouncil(
  value: CouncilDefinition,
  owner: TeamDefinition,
  pool: readonly AgentDefinition[],
): CouncilPlan {
  const definition = councilDefinitionCheck(value);
  const team = teamDefinitionCheck(owner);
  if (!definition.enabled || !team.enabled)
    throw new Error("The council and owning team must be enabled.");
  if (definition.teamId !== team.id || definition.projectId !== team.projectId)
    throw new Error("Council team/project scope does not match its owner.");
  if (new Set(pool.map((agent) => agent.id)).size !== pool.length)
    throw new Error("Duplicate agent IDs block execution.");
  const checked = pool.map(agentDefinitionCheck);
  const invocations: CouncilInvocation[] = [];
  for (const round of definition.rounds)
    for (const agentId of round.participants) {
      const agent = checked.find((item) => item.id === agentId);
      if (!agent || !agent.enabled || !team.members.includes(agentId))
        throw new Error(
          "Every council agent must be available and belong to its team.",
        );
      if (
        `${agent.role}\n\n${agent.instructions}\n\n${round.instructions}`
          .length > 16000
      )
        throw new Error(
          "The assembled role, agent and round instructions exceed the invocation instruction limit. Shorten the authored guidance before submitting.",
        );
      invocations.push({
        id: `${round.id}--${agent.id}`,
        roundId: round.id,
        roundName: round.name,
        kind: round.kind,
        agent: structuredClone(agent),
        agentRevision: definitionRevision(agent),
        instructions: round.instructions,
        inputs: [...round.inputs],
        access: "none",
        output: round.output,
        projectId: definition.projectId,
        teamId: team.id,
      });
    }
  if (invocations.length > definition.limits.maxInvocations)
    throw new Error("The expanded council exceeds its invocation limit.");
  return {
    targetKind: "council",
    definition: structuredClone(definition),
    definitionRevision: definitionRevision(definition),
    team: structuredClone(team),
    teamRevision: definitionRevision(team),
    invocations,
  };
}

function indexed(
  plan: CouncilPlan,
  contributions: readonly CouncilContribution[],
): Map<string, CouncilContribution> {
  const result = new Map<string, CouncilContribution>();
  const artifacts = new Set<string>();
  for (const contribution of contributions) {
    if (
      !plan.invocations.some((item) => item.id === contribution.invocationId) ||
      result.has(contribution.invocationId) ||
      artifacts.has(contribution.artifactId)
    )
      throw new Error("Unknown or duplicate contribution identity.");
    if (
      contribution.markdown.length >
      plan.definition.limits.maxArtifactCharacters
    )
      throw new Error("A contribution exceeds its artifact limit.");
    if (contribution.status === "succeeded" && !contribution.markdown.trim())
      throw new Error("A successful contribution must contain Markdown.");
    if (
      contribution.status === "succeeded" &&
      plan.invocations.find((item) => item.id === contribution.invocationId)
        ?.output === "plan" &&
      !contribution.plan
    )
      throw new Error(
        "A plan-contract contribution requires a validated typed plan. Arbitrary Markdown cannot be relabeled as a plan.",
      );
    if (contribution.plan) workflowPlanCheck(contribution.plan);
    if (contribution.status === "skipped" && !contribution.reason?.trim())
      throw new Error("A skipped contribution needs a recorded reason.");
    result.set(contribution.invocationId, contribution);
    artifacts.add(contribution.artifactId);
  }
  return result;
}
function roundContributions(
  plan: CouncilPlan,
  roundId: string,
  saved: Map<string, CouncilContribution>,
): CouncilContribution[] {
  const round = plan.definition.rounds.find((item) => item.id === roundId);
  if (!round) throw new Error("Input collection has no matching round.");
  const members = plan.invocations.filter((item) => item.roundId === roundId);
  const contributions = members.map((item) => saved.get(item.id));
  const succeeded = contributions.filter(
    (item) => item?.status === "succeeded",
  ).length;
  if (
    contributions.some((item) => !item) ||
    (round.completion.kind === "all"
      ? succeeded !== members.length
      : succeeded < round.completion.minimum)
  )
    throw new Error(
      "The preceding collection is incomplete under its completion policy.",
    );
  return contributions.filter((item): item is CouncilContribution =>
    Boolean(item),
  );
}
/** Only explicitly selected, sealed earlier collections enter the invocation. Same-round results never leak. */
export function councilInvocationInputs(
  plan: CouncilPlan,
  invocationId: string,
  contributions: readonly CouncilContribution[],
): CouncilContribution[] {
  const invocation = plan.invocations.find((item) => item.id === invocationId);
  if (!invocation) throw new Error("Unknown council invocation.");
  const saved = indexed(plan, contributions);
  const inputs = invocation.inputs.flatMap((id) =>
    roundContributions(plan, id, saved),
  );
  const characters = inputs.reduce(
    (sum, item) => sum + item.markdown.length + (item.reason?.length ?? 0),
    0,
  );
  if (characters > plan.definition.limits.maxContextCharacters)
    throw new Error(
      "The complete collection exceeds the context allowance; no input was truncated.",
    );
  return structuredClone(inputs);
}
export function councilResult(
  plan: CouncilPlan,
  contributions: readonly CouncilContribution[],
  source?: { sourceId: string; revision: string },
): CouncilResult {
  const saved = indexed(plan, contributions);
  for (const round of plan.definition.rounds)
    roundContributions(plan, round.id, saved);
  const result: CouncilResult = {
    definitionId: plan.definition.id,
    definitionRevision: plan.definitionRevision,
    status: "completed",
    opinions: [],
    solutions: [],
    synthesis: [],
    missing: [],
    dissent: {
      status: "not-inferred",
      evidenceArtifactIds: contributions
        .filter((item) => item.status === "succeeded")
        .map((item) => item.artifactId),
    },
    sourceLinks: source
      ? [
          {
            sourceId: source.sourceId,
            sourceRevision: source.revision,
            artifactIds: contributions.map((item) => item.artifactId),
          },
        ]
      : [],
  };
  for (const invocation of plan.invocations) {
    const contribution = saved.get(invocation.id);
    if (!contribution) throw new Error("Missing contribution.");
    const attributed = {
      ...structuredClone(contribution),
      agentId: invocation.agent.id,
      agentName: invocation.agent.name,
      agentRevision: invocation.agentRevision,
      roundId: invocation.roundId,
      roundName: invocation.roundName,
    };
    if (contribution.status === "skipped") {
      result.missing.push(attributed);
      result.status = "completed-with-gaps";
    } else if (invocation.kind === "opinion") result.opinions.push(attributed);
    else if (invocation.kind === "solution") result.solutions.push(attributed);
    else result.synthesis.push(attributed);
  }
  return result;
}
