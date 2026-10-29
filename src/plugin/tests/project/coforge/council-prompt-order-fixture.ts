import {
  agentDefinitionCheck,
  defaultCouncilDefinition,
  teamDefinitionCheck,
} from "../../../features/coforge/domain/council-definitions";
import { compileCouncil } from "../../../features/coforge/domain/council-protocol";
import type { CouncilPreflight } from "../../../features/coforge/application/council-execution";
import type {
  ExecutionAdmission,
  ExecutionRun,
} from "../../../features/coforge/domain/execution-run";

export const promptOrderAgents = ["designer", "reviewer"].map((id) =>
  agentDefinitionCheck({
    schema: "agent/v1",
    id,
    name: id,
    enabled: true,
    role: "Reviewer",
    instructions: "Inspect the tradeoffs.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  }),
);
export const promptOrderTeam = teamDefinitionCheck({
  schema: "team/v1",
  id: "team",
  name: "Studio",
  enabled: true,
  projectId: "CFP-001",
  members: promptOrderAgents.map((agent) => agent.id),
  pinnedContext: [],
  recentMessages: 10,
  allowedRecipients: [],
});
export const promptOrderDefinition = () =>
  defaultCouncilDefinition(
    "advice",
    "Design council",
    promptOrderTeam,
    promptOrderTeam.members,
  );
export const promptOrderPreview = (
  definition = promptOrderDefinition(),
): CouncilPreflight => {
  const plan = compileCouncil(definition, promptOrderTeam, promptOrderAgents);
  return {
    plan,
    source: {
      sourceId: "source",
      generation: 0,
      revision: "r1",
      markdown: "Private question",
    },
    context: "Shared context",
    invocations: plan.invocations.length,
    warnings: [],
  };
};
export const promptOrderRun = (
  admission: ExecutionAdmission,
): ExecutionRun => ({
  ...admission,
  cursor: 0,
  state: "queued",
  attempts: [],
  artifacts: [],
  createdAt: "2026-10-28T12:00:00Z",
  updatedAt: "2026-10-28T12:00:00Z",
});
