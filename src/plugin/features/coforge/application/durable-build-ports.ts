import type { DurableBuildPolicy, DurableBuildReadiness, DurableBuildRef, DurableBuildSnapshot, DurableBuildInspection } from '../domain/durable-build';
import type { ConfiguredStepExecution } from '../domain/configured-workflow-run';
import type { Idea, IntegrationSettings, Settings } from '../domain/types';

export class DurableBuildCapacityError extends Error { constructor(message = 'The background Build capacity is occupied. Waiting for its original owners to settle.') { super(message); this.name = 'DurableBuildCapacityError'; } }

/** Serializable captured input. Credentials, callbacks, AbortSignals and renderer objects never cross IPC. */
export interface DurableBuildRequest {
  /** Native infrastructure seals actual overlapping managed-folder boundaries before hashing/dispatch. */
  protectedProjectPaths?: string[];
  version: 1; jobId: string; projectId: string; ideaId: string; runId: string; attemptId: string; policy: DurableBuildPolicy;
  input: { jobId: string; stage: 'implement'; idea: Omit<Idea, 'workflowRun' | 'workflowHistory' | 'increment'>; settings: Settings;
    integration: Pick<IntegrationSettings, 'projectPath' | 'worktreeFolder' | 'allowImplementation' | 'claudeBin' | 'codexBin' | 'ideasFolder' | 'publicFolder'>;
    workflow: ConfiguredStepExecution };
}
/** prepare reserves without provider execution; start is authorized only after the host persisted the reference. */
export interface DurableBuildPort {
  /** Saved vault-wide capacity; lowering never cancels an existing owner. */
  configureConcurrency(maxBuilds: number): Promise<void>;
  /** Administrative cancellation of a proven unstarted preparation by stable job ID; never launches a daemon/provider. */
  cancelUnstarted(jobId: string): Promise<void>;
  readiness(): Promise<DurableBuildReadiness>;
  /** Explicitly archive only a proven unused failed bootstrap; no new daemon or provider is started. */
  repairBootstrap?(inspected: true): Promise<DurableBuildReadiness>;
  prepare(request: DurableBuildRequest): Promise<DurableBuildRef>;
  start(ref: DurableBuildRef): Promise<DurableBuildSnapshot>;
  inspect(ref: DurableBuildRef): Promise<DurableBuildSnapshot>;
  /** Read retained files/evidence without asserting liveness or launching a provider. */
  inspectRetained(ref: DurableBuildRef): Promise<DurableBuildInspection>;
  /** Explicit operator inspection plus native quiescence proof; never resumes or launches a provider. */
  recover(ref: DurableBuildRef, inspected: true, minimumSequence: number, evidenceHash: string): Promise<DurableBuildSnapshot>;
  cancel(ref: DurableBuildRef): Promise<DurableBuildSnapshot>;
  acknowledge(ref: DurableBuildRef, sequence: number): Promise<void>;
  /** Detach transport without cancelling admitted execution. */
  detach?(): Promise<void>;
}
