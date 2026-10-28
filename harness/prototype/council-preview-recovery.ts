import {
  councilAdmission,
  councilDispatch,
  resolveCouncilPlan,
  type CouncilSource,
} from "../../src/plugin/features/coforge/application/council-execution";
import type { CouncilCatalogueSnapshot } from "../../src/plugin/features/coforge/application/council-catalogue";
import { compileWorkflowV2 } from "../../src/plugin/features/coforge/application/workflow-v2-compiler";
import {
  workflowV2Admission,
  workflowV2Dispatch,
} from "../../src/plugin/features/coforge/application/workflow-v2-execution";
import {
  emptyExecutionJournal,
  executionJournalCheck,
  type ExecutionAdmission,
  type ExecutionArtifact,
  type ExecutionRun,
} from "../../src/plugin/features/coforge/domain/execution-run";
import { councilExampleDefinitions } from "./council-preview-data";

/** Explicit browser-only fixtures. The real journal validator rejects inconsistent review state. */
export function councilReviewJournal(
  scenario: string | null,
  catalogue: CouncilCatalogueSnapshot,
  source: CouncilSource,
) {
  if (!["unknown", "publishing", "checkpoint"].includes(scenario ?? ""))
    return emptyExecutionJournal();
  const definitions = catalogue.valid.map((entry) => entry.definition);
  const owner = definitions.find(
    (definition) => definition.schema === "team/v1",
  );
  if (!owner || owner.schema !== "team/v1")
    throw new Error("The review fixture requires its example team.");
  let admission: ExecutionAdmission;
  if (scenario === "checkpoint") {
    const plan = compileWorkflowV2(
      councilExampleDefinitions(owner.projectId).workflow,
      {
        kind: "note",
        sourceId: source.sourceId,
        revision: source.revision,
        markdown: source.markdown,
      },
      {
        projectId: owner.projectId,
        team: owner,
        agents: definitions.filter(
          (definition) => definition.schema === "agent/v1",
        ),
        councils: definitions.filter(
          (definition) => definition.schema === "council/v1",
        ),
      },
    );
    admission = workflowV2Admission(
      {
        plan,
        source,
        context: "Marked browser-only checkpoint example.",
        invocations: plan.invocations.length,
        warnings: [],
      },
      "review-run",
      "review-submission",
      true,
    );
  } else {
    const plan = resolveCouncilPlan(catalogue, {
      kind: "council",
      id: "council-example",
      teamId: owner.id,
    });
    admission = councilAdmission(
      {
        plan,
        source,
        context: "Marked browser-only recovery example.",
        invocations: plan.invocations.length,
        warnings: [],
      },
      "review-run",
      "review-submission",
      { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, simulation: true },
    );
  }
  const at = "2026-10-28T12:00:00.000Z";
  const run: ExecutionRun = {
    ...admission,
    state: scenario === "unknown" ? "running" : "publishing",
    cursor: 0,
    attempts: [],
    artifacts: [],
    createdAt: at,
    updatedAt: at,
  };
  const count = scenario === "checkpoint" ? run.invocations.length : 1;
  for (let index = 0; index < count; index++) {
    const invocation = run.invocations[index]!;
    const dispatch =
      scenario === "checkpoint"
        ? workflowV2Dispatch(run, invocation)
        : councilDispatch(run, invocation);
    const attempt = {
      id: `review-attempt-${index}`,
      invocationId: invocation.id,
      status:
        scenario === "unknown"
          ? ("dispatching" as const)
          : scenario === "checkpoint"
            ? ("published" as const)
            : ("responded" as const),
      startedAt: at,
      dispatch,
    };
    if (scenario === "unknown") {
      run.attempts.push(attempt);
      break;
    }
    const artifact: ExecutionArtifact = {
      id: `review-artifact-${index}`,
      runId: run.id,
      invocationId: invocation.id,
      attemptId: attempt.id,
      roundId: invocation.roundId,
      agentId: invocation.agentId,
      agentRevision: invocation.agentRevision,
      provider: "demo",
      model: invocation.model,
      inputArtifactIds: dispatch.inputArtifactIds,
      createdAt: at,
      simulated: true,
      markdown:
        "**Simulated review contribution.** This preserved evidence is fake browser data, with assumptions and disagreement left visible.",
    };
    run.artifacts.push(artifact);
    run.attempts.push({ ...attempt, artifactId: artifact.id });
  }
  if (scenario === "checkpoint") {
    run.cursor = run.invocations.length;
    run.state = "waiting-human";
    run.activeCheckpointId = run.checkpoints?.[0]?.id;
  }
  return executionJournalCheck({
    format: "coforge-execution/v2",
    revision: 0,
    runs: [run],
    submissions: [{ key: admission.submissionKey, runId: run.id }],
  });
}
