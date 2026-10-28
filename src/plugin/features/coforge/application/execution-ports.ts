import type {
  ExecutionArtifact,
  ExecutionAttempt,
  ExecutionDispatch,
  ExecutionInvocation,
  ExecutionJournal,
  ExecutionResponse,
  ExecutionRun,
} from "../domain/execution-run";
import type { TeamMessageDraft } from "../domain/team-messages";
import type { ExecutionLocalAction } from "../domain/execution-local-action";
import type { ExecutionTimingHooks } from "./execution-timing";

export interface ExecutionJournalPort {
  load(): Promise<ExecutionJournal>;
  save(next: ExecutionJournal, previousRevision: number): Promise<void>;
}
export interface ExecutionKernelHost {
  journal: ExecutionJournalPort;
  now(): string;
  monotonicMs?(): number;
  id(): string;
  assertEligible(
    run: ExecutionRun,
    invocation: ExecutionInvocation,
  ): Promise<void>;
  resolveInvocation(
    run: ExecutionRun,
    invocation: ExecutionInvocation,
  ): ExecutionDispatch;
  invoke(
    run: ExecutionRun,
    invocation: ExecutionInvocation,
    attempt: ExecutionAttempt,
    timing?: ExecutionTimingHooks,
  ): Promise<ExecutionResponse>;
  publish(run: ExecutionRun, artifact: ExecutionArtifact): Promise<void>;
  cancelInvocation?(runId: string): void;
  /** Trusted host validation and root-budget reservation share the artifact's durable commit. */
  commitMessages?(
    journal: ExecutionJournal,
    run: ExecutionRun,
    attempt: ExecutionAttempt,
    drafts: readonly TeamMessageDraft[],
  ): void;
  canSkip?(run: ExecutionRun, invocation: ExecutionInvocation): boolean;
  validateProjectionTarget?(run: ExecutionRun, sourceId: string): Promise<void>;
  assertLocalEligible?(
    run: ExecutionRun,
    action: ExecutionLocalAction,
  ): Promise<void>;
  commitLocalAction?(
    journal: ExecutionJournal,
    run: ExecutionRun,
    action: ExecutionLocalAction,
  ): string[];
}
