import {
  defaultCouncilDefinition,
  type AgentDefinition,
  type TeamDefinition,
} from "../../src/plugin/features/coforge/domain/council-definitions";
import type { WorkflowV2Definition } from "../../src/plugin/features/coforge/domain/configured-workflow-v2";

export function councilExampleDefinitions(projectId: string) {
  const agents: AgentDefinition[] = [
    {
      id: "agent-product",
      name: "Product designer",
      role: "Product design",
      instructions:
        "Describe the player experience, tradeoffs and open questions.",
    },
    {
      id: "agent-architect",
      name: "Architect",
      role: "Software architecture",
      instructions:
        "Review module boundaries, contracts and implementation risks.",
    },
    {
      id: "agent-qa",
      name: "Quality reviewer",
      role: "Quality and accessibility",
      instructions:
        "Identify failure cases, accessibility needs and acceptance checks.",
    },
  ].map((agent) => ({
    ...agent,
    schema: "agent/v1",
    enabled: true,
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  }));
  const team: TeamDefinition = {
    schema: "team/v1",
    id: "team-example",
    name: "Example studio team",
    enabled: true,
    projectId,
    members: agents.map((agent) => agent.id),
    pinnedContext: [],
    recentMessages: 10,
    allowedRecipients: [],
  };
  const council = defaultCouncilDefinition(
    "council-example",
    "Example design council",
    team,
    team.members,
  );
  const workflow: WorkflowV2Definition = {
    format: "coforge-workflow/v2",
    revision: "example-workflow",
    name: "Example council proposal",
    subjectMode: "note",
    teamId: team.id,
    limits: {
      timeoutSeconds: 180,
      maxTurns: 12,
      maxBudgetUsd: 1,
      maxInvocations: 24,
    },
    collections: [{ id: "discussion", producers: ["discussion"] }],
    steps: [
      {
        id: "discussion",
        kind: "council",
        name: "Discuss the proposal",
        instructions: "Preserve individual opinions and proposals.",
        councilId: council.id,
        inputs: [],
      },
      {
        id: "decision",
        kind: "checklist",
        name: "Choose the next direction",
        instructions: "Record a direction after reviewing every contribution.",
        items: [
          {
            id: "reviewed",
            label: "I reviewed the complete discussion",
            required: true,
          },
          {
            id: "direction",
            label: "I selected the proposal to continue",
            required: true,
          },
        ],
      },
    ],
  };
  return { agents, team, council, workflow };
}
