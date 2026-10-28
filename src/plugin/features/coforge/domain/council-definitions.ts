import {
  boolean,
  list,
  number,
  oneOf,
  optional,
  record,
  shape,
  text,
} from "./check";
import { contextEventId } from "./integrity";
import { agentModelCheck } from "./stage-agents";
import type { Provider } from "./types";
import { agentConnectionProfileIssue } from "./agent-connection-profiles";

export const councilIdCheck = text({
  min: 1,
  max: 80,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u,
});
export interface AgentDefinition {
  schema: "agent/v1";
  id: string;
  name: string;
  enabled: boolean;
  role: string;
  instructions: string;
  provider: Provider;
  model: string;
  outputDefault?: "markdown" | "plan";
  connectionProfile?: string;
  contextSources: string[];
  requestedCapabilities: { project: "none" | "read"; messaging: boolean };
}
export interface TeamDefinition {
  schema: "team/v1";
  id: string;
  name: string;
  enabled: boolean;
  projectId: string;
  members: string[];
  pinnedContext: string[];
  recentMessages: number;
  allowedRecipients: string[];
}
export interface CouncilRound {
  id: string;
  name: string;
  kind: "opinion" | "solution" | "synthesis";
  participants: string[];
  instructions: string;
  inputs: string[];
  output: "markdown" | "plan";
  access: "none";
  completion: { kind: "all" } | { kind: "partial"; minimum: number };
}
export interface CouncilDefinition {
  schema: "council/v1";
  id: string;
  name: string;
  enabled: boolean;
  teamId: string;
  projectId: string;
  members: string[];
  rounds: CouncilRound[];
  limits: {
    maxInvocations: number;
    maxGeneratedMessages: number;
    maxDescendantRuns: number;
    maxDelegationDepth: number;
    maxExecutionSeconds: number;
    maxContextCharacters: number;
    maxArtifactCharacters: number;
  };
}
export type CouncilDefinitionDocument =
  AgentDefinition | TeamDefinition | CouncilDefinition;
const base = {
  id: councilIdCheck,
  name: text({ trim: true, min: 1, max: 100 }),
  enabled: boolean,
};
const ids = list(councilIdCheck, { max: 24 });
const instructions = text({ max: 16000 });
const agent = shape(
  {
    ...base,
    schema: oneOf(["agent/v1"] as const),
    role: text({ max: 500 }),
    instructions,
    provider: oneOf(["demo", "claude", "herdr"] as const),
    model: agentModelCheck,
    outputDefault: optional(oneOf(["markdown", "plan"] as const)),
    connectionProfile: optional(councilIdCheck),
    contextSources: list(text({ min: 1, max: 300 }), { max: 40 }),
    requestedCapabilities: shape(
      { project: oneOf(["none", "read"] as const), messaging: boolean },
      { strict: true },
    ),
  },
  { strict: true },
);
const team = shape(
  {
    ...base,
    schema: oneOf(["team/v1"] as const),
    projectId: councilIdCheck,
    members: ids,
    pinnedContext: list(text({ min: 1, max: 300 }), { max: 40 }),
    recentMessages: number({ integer: true, min: 0, max: 100 }),
    allowedRecipients: ids,
  },
  { strict: true },
);
function unique(values: readonly string[], name: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`${name} must be unique.`);
}
export function agentDefinitionCheck(value: unknown): AgentDefinition {
  const checked = agent(value);
  const issue = agentConnectionProfileIssue(checked);
  if (checked.enabled && issue) throw new Error(issue);
  return checked;
}
export function teamDefinitionCheck(value: unknown): TeamDefinition {
  const checked = team(value);
  unique(checked.members, "Team members");
  unique(checked.allowedRecipients, "Allowed recipients");
  return checked;
}
function completionCheck(value: unknown): CouncilRound["completion"] {
  return record(value).kind === "all"
    ? shape({ kind: oneOf(["all"] as const) }, { strict: true })(value)
    : shape(
        {
          kind: oneOf(["partial"] as const),
          minimum: number({ integer: true, min: 1, max: 24 }),
        },
        { strict: true },
      )(value);
}
const round = shape(
  {
    id: councilIdCheck,
    name: base.name,
    kind: oneOf(["opinion", "solution", "synthesis"] as const),
    participants: list(councilIdCheck, { min: 1, max: 24 }),
    instructions,
    inputs: list(councilIdCheck, { max: 24 }),
    output: oneOf(["markdown", "plan"] as const),
    access: oneOf(["none"] as const),
    completion: completionCheck,
  },
  { strict: true },
);
const council = shape(
  {
    ...base,
    schema: oneOf(["council/v1"] as const),
    teamId: councilIdCheck,
    projectId: councilIdCheck,
    members: list(councilIdCheck, { min: 1, max: 24 }),
    rounds: list(round, { min: 1, max: 12 }),
    limits: shape(
      {
        maxInvocations: number({ integer: true, min: 1, max: 100 }),
        maxGeneratedMessages: number({ integer: true, min: 0, max: 100 }),
        maxDescendantRuns: number({ integer: true, min: 0, max: 100 }),
        maxDelegationDepth: number({ integer: true, min: 0, max: 10 }),
        maxExecutionSeconds: number({ integer: true, min: 15, max: 7200 }),
        maxContextCharacters: number({ integer: true, min: 1000, max: 200000 }),
        maxArtifactCharacters: number({ integer: true, min: 100, max: 16000 }),
      },
      { strict: true },
    ),
  },
  { strict: true },
);
export function councilDefinitionCheck(value: unknown): CouncilDefinition {
  const checked = council(value);
  unique(checked.members, "Council members");
  unique(
    checked.rounds.map((item) => item.id),
    "Round IDs",
  );
  const earlier = new Set<string>();
  for (const item of checked.rounds) {
    unique(item.participants, "Round participants");
    unique(item.inputs, "Input bindings");
    if (item.inputs.some((id) => !earlier.has(id)))
      throw new Error("Input bindings may only select earlier rounds.");
    if (item.participants.some((id) => !checked.members.includes(id)))
      throw new Error("Round participant is not a council member.");
    if (item.kind === "synthesis" && item.participants.length !== 1)
      throw new Error("Synthesis requires one chair.");
    if (
      item.completion.kind === "partial" &&
      item.completion.minimum > item.participants.length
    )
      throw new Error("Partial minimum exceeds the participant count.");
    earlier.add(item.id);
  }
  return checked;
}
export function councilDocumentCheck(
  value: unknown,
): CouncilDefinitionDocument {
  const schema = record(value).schema;
  if (schema === "agent/v1") return agentDefinitionCheck(value);
  if (schema === "team/v1") return teamDefinitionCheck(value);
  if (schema === "council/v1") return councilDefinitionCheck(value);
  throw new Error("Unsupported CoForge definition schema.");
}
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalized(item)]),
    );
  return value;
}
/** Content fingerprint, not an authorization signature. File names/paths are deliberately absent. */
export function definitionRevision(value: CouncilDefinitionDocument): string {
  return contextEventId(
    JSON.stringify(normalized(councilDocumentCheck(value))),
  );
}
export function defaultCouncilDefinition(
  id: string,
  name: string,
  owner: TeamDefinition,
  members: string[],
): CouncilDefinition {
  const roundBase = {
    participants: [...members],
    output: "markdown" as const,
    access: "none" as const,
    completion: { kind: "all" as const },
  };
  return councilDefinitionCheck({
    schema: "council/v1",
    id,
    name,
    enabled: true,
    teamId: owner.id,
    projectId: owner.projectId,
    members: [...members],
    rounds: [
      {
        ...roundBase,
        id: "opinions",
        name: "Opinions",
        kind: "opinion",
        instructions:
          "Give an independent assessment, assumptions, risks and questions.",
        inputs: [],
      },
      {
        ...roundBase,
        id: "solutions",
        name: "Solutions",
        kind: "solution",
        instructions:
          "Propose a solution considering every opinion. Preserve disagreements.",
        inputs: ["opinions"],
      },
    ],
    limits: {
      maxInvocations: 24,
      maxGeneratedMessages: 10,
      maxDescendantRuns: 10,
      maxDelegationDepth: 3,
      maxExecutionSeconds: 900,
      maxContextCharacters: 100000,
      maxArtifactCharacters: 16000,
    },
  });
}
