import type { AutomationContext, AutomationOrigin } from '../domain/automation-context';
import type { WorkflowTriggerDraft, WorkflowTriggerOccurrence, WorkflowTriggerState } from '../domain/workflow-triggers';
export interface WorkflowTriggerSnapshot extends WorkflowTriggerState { ready: boolean; error: string }
export interface WorkflowTriggerStorage { load(): Promise<WorkflowTriggerState>; save(state: WorkflowTriggerState): Promise<void> }
export interface WorkflowTriggerHost {
  owned(): boolean; configure(): Promise<void>; readiness(projectId: string, workflow?: 'v1' | 'v2'): { ready: boolean; reason: string };
  describe(input: WorkflowTriggerDraft): Promise<{ revision: string; definitionJson: string; subject: 'note' | 'idea' }>;
  active(workflow: 'v1' | 'v2', runId: string): boolean;
  dispatch(input: WorkflowTriggerDraft, occurrence: WorkflowTriggerOccurrence, origin: AutomationOrigin, signal: AbortSignal): Promise<{ runId: string; sourcePath?: string }>;
  subscribe(listener: (event: AutomationContext) => void): () => void;
}
export interface WorkflowTriggerActions {
  snapshot(): WorkflowTriggerSnapshot; subscribe(listener: (state: WorkflowTriggerSnapshot) => void): () => void;
  describe(projectId: string, workflow: 'v1' | 'v2'): Promise<{ revision: string; name: string; subject: 'note' | 'idea' }>;
  save(input: unknown, id?: string, expectedRevision?: number, acknowledgeUnknown?: boolean): Promise<void>;
  remove(id: string, expectedRevision: number): Promise<void>; refresh(): Promise<void>;
}
