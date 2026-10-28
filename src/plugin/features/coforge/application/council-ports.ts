import type { CouncilCatalogueActions } from "./council-catalogue";
import type { CouncilPreflight, CouncilTarget } from "./council-execution";
import type { ExecutionRun } from "../domain/execution-run";
import type { IntakeBinding, IntakeCandidate } from "../domain/intake-bindings";
import type { IntakeResult } from "./intake-service";
import type { MessageOutboxEntry } from "../domain/team-messages";
import type { CouncilDefinitionFolders } from "../domain/council-definition-folders";
import type { CouncilFolderActions } from "./council-catalogue";
import type { ExecutionAllowancePatch } from "../domain/execution-allowance";

export interface CouncilPreferences {
  format: "coforge-council-settings/v1";
  revision: number;
  executorId: string;
  bindings: IntakeBinding[];
  pausedProjectIds?: string[];
  definitionFolders?: CouncilDefinitionFolders;
}
export interface CouncilRuntimeSnapshot {
  ready: boolean;
  paused: boolean;
  executor: boolean;
  deviceId: string;
  preferences: CouncilPreferences;
  runs: ExecutionRun[];
  intake: IntakeResult[];
  error: string;
}
export interface CouncilActions {
  definitionFolders: CouncilFolderActions;
  workflows: import("./workflow-v2-ports").WorkflowV2Actions;
  catalogue: CouncilCatalogueActions;
  snapshot(): CouncilRuntimeSnapshot;
  subscribe(listener: (snapshot: CouncilRuntimeSnapshot) => void): () => void;
  designateExecutor(): Promise<void>;
  saveBindings(bindings: IntakeBinding[], revision: number): Promise<void>;
  previewInbox(bindingId: string): Promise<IntakeCandidate[]>;
  activateInbox(bindingId: string, selectedSourceIds: string[]): Promise<void>;
  resetInbox(
    bindingId: string,
    expectedPreferencesRevision: number,
  ): Promise<void>;
  preflight(
    target: CouncilTarget,
    sourcePath: string,
  ): Promise<CouncilPreflight>;
  submit(
    target: CouncilTarget,
    sourcePath: string,
    expectedIdentity?: string,
  ): Promise<ExecutionRun>;
  simulate(
    target: CouncilTarget,
    sourcePath: string,
    destination: string,
    expectedIdentity?: string,
  ): Promise<ExecutionRun>;
  runAgain(sourceId: string): Promise<void>;
  setSourceState(
    path: string,
    state: { draft: boolean; ready: boolean },
  ): Promise<void>;
  resume(): Promise<void>;
  pause(): void;
  pauseProject(projectId: string, paused: boolean): Promise<void>;
  pauseRun(runId: string, paused: boolean): Promise<void>;
  extendAllowance(
    runId: string,
    extension: ExecutionAllowancePatch,
  ): Promise<void>;
  retry(runId: string, acknowledgeUnknown: boolean): Promise<void>;
  repair(runId: string): Promise<void>;
  cancel(runId: string): Promise<void>;
  acknowledgeCheckpoint(
    runId: string,
    checkpointId: string,
    checkedIds: string[],
    note: string,
  ): Promise<void>;
  messages(): MessageOutboxEntry[];
  postInformation(teamId: string, body: string): Promise<void>;
  flushMessages(): Promise<void>;
  stopConversation(rootId: string): Promise<void>;
  skipInvocation(
    runId: string,
    reason: string,
    acknowledgeUnknown?: boolean,
  ): Promise<void>;
  continueSnapshot(runId: string): Promise<void>;
  exportRun(runId: string): Promise<string>;
  pruneRun(runId: string): Promise<void>;
  reassignProjection(runId: string, targetPath: string): Promise<void>;
  handoffPlan(
    runId: string,
    artifactId: string,
    ideaId: string,
    expectedProposalRevision: string,
  ): Promise<void>;
}
