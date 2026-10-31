import type { AutomationContext } from '../domain/automation-context';
import type { InvocationExecutionLimits } from './invocation-project-context';
import type { CouncilTaskBinding } from '../domain/workflow-council-binding';
import type { WorkflowAttempt } from '../domain/configured-workflow-run';
export class AgentTaskNotStartedError extends Error {
  constructor(message: string) { super(message); this.name = 'AgentTaskNotStartedError'; }
}
/** A cancelled parent cannot authorize replay while an external cancellation is unresolved. */
export const uncertainTaskAttempt = (attempt: WorkflowAttempt): boolean =>
  (attempt.nudgeState === 'unknown' || attempt.councilCancellation === 'unknown') && !attempt.nudgeAcknowledgedAt;
export interface AgentTaskRequest {
  projectId: string; ideaId: string; workflowRunId: string; attemptId: string; stepId: string;
  teamId: string; agentId: string; prompt: string; context: string; sourcePath: string;
  councilId?: string;
  councilBinding?: CouncilTaskBinding;
  title?: string;
  limits: InvocationExecutionLimits; automationEvent?: AutomationContext; signal: AbortSignal;
}
export interface AgentTaskReceipt { runId: string; sourcePath: string; sourceId?: string; simulated?: boolean }
export type AgentTaskResult = { state: 'pending' | 'attention' | 'cancelled' | 'missing' } | { state: 'completed'; projectId: string; sourcePath: string; sourceId?: string; markdown: string };
export interface AgentTaskPort {
  prepareCoworker?(projectId: string, coworkerId: string): Promise<import('../domain/workflow-coworker-binding').WorkflowCoworkerProfile>;
  create(input: AgentTaskRequest): Promise<AgentTaskReceipt>;
  prepareCouncil?(projectId: string, councilId: string): Promise<CouncilTaskBinding>;
  cancel?(runId: string): Promise<void>;
  result?(runId: string): Promise<AgentTaskResult>;
}
