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
  /** Worker adapter only: an authorized reviewed snapshot pins a fresh editing tree to this exact commit. */
  baseCommit?: string;
  /** Trusted worker retry approval identity; a new epoch creates a distinct physical tree within the same run. */
  workspaceEpoch?: string;
}
/** Private journal; never part of workflow definition exports or public views. */
export interface WorkflowWorkspaceRecord {
  id: string;
  runId: string;
  workspaceEpoch?: string;
  /** Private proof lookup for a paid-free operator copy; never a fabricated provider job. */
  operatorMaterializationId?: string;
  /** Privately authorized foreground AI seed, distinct from an unpaid operator copy. */
  reviewedImportId?: string;
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
export interface ReviewedWorkspaceMaterializationRequest extends WorkflowWorkspaceRequest {
  baseCommit: string; workspaceEpoch: string; operatorMaterializationId: string;
}
export interface ReviewedWorkflowWorkspaceRequest extends WorkflowWorkspaceRequest {
  baseCommit: string; workspaceEpoch: string; reviewedImportId: string;
}
export interface WorkflowWorkspaceStorage {
  load(): Promise<WorkflowWorkspaceRecord[]>;
  save(records: WorkflowWorkspaceRecord[]): Promise<void>;
}
export interface WorkflowWorkspaceLease {
  readOnly?: true;
  protectedProjectPaths?: readonly string[];
  id?: string;
  cwd: string;
  validate?(): Promise<void>;
  capture(summary: string): Promise<Increment | undefined>;
  release(uncertain?: boolean): Promise<void>;
}
export interface StoppedWorkflowWorkspaceRequest {
  workspaceId: string; runId: string; projectId: string; attemptId: string;
  /** Existing durable host evidence need not be republished on every reopen. */
  capture?: boolean;
}
export interface WorkflowWorkspaces {
  start(): Promise<void>;
  acquire(request: WorkflowWorkspaceRequest): Promise<WorkflowWorkspaceLease>;
  assertReviewable(id: string, expected?: Increment): Promise<void>;
  /** Only after the external attempt has been explicitly inspected/recovered. */
  acknowledge(id: string, attemptId: string, reusable?: boolean): Promise<void>;
  /** Trusted host recovery only, after the original provider and descendants are proven stopped. */
  recoverStopped?(request: StoppedWorkflowWorkspaceRequest): Promise<Increment | undefined>;
}
