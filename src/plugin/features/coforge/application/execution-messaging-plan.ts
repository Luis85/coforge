import { decodeCouncilPlan } from "./council-execution";
import { effectiveExecutionAllowance } from "../domain/execution-allowance";
import { decodeWorkflowV2Plan, isWorkflowV2Run } from "./workflow-v2-execution";
import type {
  AgentDefinition,
  CouncilDefinition,
  TeamDefinition,
} from "../domain/council-definitions";
import type {
  ExecutionInvocation,
  ExecutionRun,
} from "../domain/execution-run";

export interface ExecutionMessagingPlan {
  team: TeamDefinition;
  definitionId: string;
  limits: CouncilDefinition["limits"];
  agent(invocation: ExecutionInvocation): AgentDefinition | undefined;
}
/** One read adapter exposes pinned grants without giving either destination another execution owner. */
export function executionMessagingPlan(
  run: ExecutionRun,
): ExecutionMessagingPlan {
  const allowance = effectiveExecutionAllowance(run);
  if (!isWorkflowV2Run(run)) {
    const plan = decodeCouncilPlan(run);
    return {
      team: plan.team,
      definitionId: plan.definition.id,
      limits: {
        ...plan.definition.limits,
        maxInvocations: allowance.maxInvocations,
      },
      agent: (invocation) =>
        plan.invocations.find((item) => item.id === invocation.id)?.agent,
    };
  }
  const plan = decodeWorkflowV2Plan(run);
  return {
    team: plan.catalogue.team,
    definitionId: run.projectId,
    limits: {
      maxInvocations: allowance.maxInvocations,
      maxGeneratedMessages: 10,
      maxDescendantRuns: 10,
      maxDelegationDepth: 3,
      maxExecutionSeconds: 900,
      maxContextCharacters: 160000,
      maxArtifactCharacters: 16000,
    },
    agent: (invocation) =>
      plan.catalogue.agents.find((item) => item.id === invocation.agentId),
  };
}
