import type { WorkflowV2Definition } from "../domain/configured-workflow-v2";
import type { ExecutionRun } from "../domain/execution-run";
import type { WorkflowV2Plan } from "./workflow-v2-compiler";
import type { CouncilSource } from "./council-execution";

export interface StoredWorkflowV2 {
  definition: WorkflowV2Definition | null;
  revision: string;
}
export interface WorkflowV2Preview {
  projectPrompt?: string;
  plan: WorkflowV2Plan;
  source: CouncilSource;
  context: string;
  invocations: number;
  warnings: string[];
}
export interface WorkflowV2Actions {
  load(projectId: string): Promise<StoredWorkflowV2>;
  save(
    projectId: string,
    definition: WorkflowV2Definition,
    expectedRevision?: string,
  ): Promise<StoredWorkflowV2>;
  preflight(
    projectId: string,
    sourcePath: string,
    simulation?: boolean,
  ): Promise<WorkflowV2Preview>;
  start(
    projectId: string,
    sourcePath: string,
    simulation?: boolean,
    destination?: string,
    expectedIdentity?: string,
  ): Promise<ExecutionRun>;
}
