import type { AutomationContext } from '../domain/automation-context';
import type { InvocationExecutionLimits } from './invocation-project-context';
export interface AgentTaskRequest {
  projectId: string; ideaId: string; workflowRunId: string; attemptId: string; stepId: string;
  teamId: string; agentId: string; prompt: string; context: string; sourcePath: string;
  councilId?: string;
  limits: InvocationExecutionLimits; automationEvent?: AutomationContext; signal: AbortSignal;
}
export interface AgentTaskReceipt { runId: string; sourcePath: string; sourceId?: string; simulated?: boolean }
export type AgentTaskResult = { state: 'pending' | 'attention' | 'cancelled' | 'missing' } | { state: 'completed'; projectId: string; sourcePath: string; sourceId?: string; markdown: string };
export interface AgentTaskPort { create(input: AgentTaskRequest): Promise<AgentTaskReceipt>; cancel?(runId: string): Promise<void>; result?(runId: string): Promise<AgentTaskResult> }
