import type { AutomationContext } from '../domain/automation-context';
import type { InvocationExecutionLimits } from './invocation-project-context';
export interface AgentTaskRequest {
  projectId: string; ideaId: string; workflowRunId: string; attemptId: string; stepId: string;
  teamId: string; agentId: string; prompt: string; context: string; sourcePath: string;
  limits: InvocationExecutionLimits; automationEvent?: AutomationContext; signal: AbortSignal;
}
export interface AgentTaskReceipt { runId: string; sourcePath: string; simulated?: boolean }
export interface AgentTaskPort { create(input: AgentTaskRequest): Promise<AgentTaskReceipt>; cancel?(runId: string): Promise<void> }
