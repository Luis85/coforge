import type { WorkflowAccess } from "../domain/configured-workflow";
import type { Increment, IntegrationSettings } from "../domain/types";

export interface WorkflowWorkspaceRequest {
  runId: string;
  projectId: string;
  attemptId: string;
  access: WorkflowAccess;
  integration: IntegrationSettings;
  workspaceId?: string;
  signal?: AbortSignal;
}
/** Private journal; never part of workflow definition exports or public views. */
export interface WorkflowWorkspaceRecord {
  id: string;
  runId: string;
  projectId: string;
  projectPath: string;
  cwd: string;
  branch: string;
  baseCommit: string;
  phase: "reserved" | "ready" | "attention" | "retired";
  pointer?: string;
  directoryDevice?: number;
  directoryInode?: number;
  activeAttemptId?: string;
  reviewedAttemptId?: string;
  lastAttemptId?: string;
}
export interface WorkflowWorkspaceStorage {
  load(): Promise<WorkflowWorkspaceRecord[]>;
  save(records: WorkflowWorkspaceRecord[]): Promise<void>;
}
export interface WorkflowWorkspaceLease {
  id?: string;
  cwd: string;
  capture(summary: string): Promise<Increment | undefined>;
  release(uncertain?: boolean): Promise<void>;
}
export interface WorkflowWorkspaces {
  start(): Promise<void>;
  acquire(request: WorkflowWorkspaceRequest): Promise<WorkflowWorkspaceLease>;
  assertReviewable(id: string, expected?: Increment): Promise<void>;
  /** Only after the external attempt has been explicitly inspected/recovered. */
  acknowledge(id: string, attemptId: string, reusable?: boolean): Promise<void>;
}
