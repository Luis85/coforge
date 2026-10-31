import type { AgentJob, Idea } from "../../../features/coforge/domain/types";
import { STAGE_LABELS } from "../../../features/coforge/domain/types";
import { isActiveJob } from "../../../features/coforge/domain/workflow";
import { configuredAgentLabel } from "./configured-workflow-display";
const clock = (at: string) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
export function workflowAttemptRows(ideas: Idea[], jobs: AgentJob[]) {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const current = ideas.flatMap((idea) =>
    [
      ...(idea.workflowHistory ?? []),
      ...(idea.workflowRun ? [idea.workflowRun] : []),
    ].flatMap((run) =>
      run.attempts.map((attempt) => {
        const job = attempt.jobId ? byId.get(attempt.jobId) : undefined;
        const step = run.definition.steps.find(
          (step) => step.id === attempt.stepId,
        );
        const councilName = step?.kind === 'council' ? run.councilBindings?.find(item => item.stepId === step.id)?.binding.councilName ?? step.councilId : '';
        return {
          id: attempt.id,
          ideaId: idea.id,
          councilRunId: attempt.kind === 'council' ? attempt.nudgeRunId ?? '' : '',
          councilProjectId: run.projectId,
          councilName,
          status: attempt.status,
          stageLabel: attempt.stepName,
          providerLabel: councilName ? `Council · ${councilName}` : run.external && step?.kind === 'ai' ? 'External MCP client · model not reported' : step
            ? configuredAgentLabel(step, true)
            : "Runner not recorded",
          time: clock(attempt.startedAt),
          at: attempt.startedAt,
          canCancel: Boolean(job && isActiveJob(job)),
          jobId: job?.id ?? "",
          costText:
            job?.costUsd === undefined
              ? ""
              : `Reported cost: $${job.costUsd.toFixed(4)}`,
          log:
            [
              ...(job?.logs ?? []),
              ...(attempt.note ? [attempt.note] : []),
              ...(attempt.error ? [attempt.error] : []),
            ].join("\n") || "No additional notes.",
        };
      }),
    ),
  );
  const legacy = jobs
    .filter((job) => !job.workflow)
    .map((job) => ({
      id: job.id,
      ideaId: job.ideaId,
      councilRunId: '', councilProjectId: job.projectId ?? '', councilName: '',
      status: job.status,
      stageLabel: STAGE_LABELS[job.stage],
      providerLabel:
        job.provider === "demo"
          ? "Simulation"
          : job.provider === "mcp" ? "External MCP client · model not reported" : `${job.provider === 'codex' ? 'Codex' : job.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${job.model ?? "model not recorded"}`,
      time: clock(job.startedAt),
      at: job.startedAt,
      canCancel: isActiveJob(job),
      jobId: job.id,
      costText:
        job.costUsd === undefined
          ? ""
          : `Reported cost: $${job.costUsd.toFixed(4)}`,
      log:
        [...job.logs, ...(job.error ? [job.error] : [])].join("\n") ||
        "No additional notes.",
    }));
  return [...current, ...legacy].sort((a, b) => b.at.localeCompare(a.at));
}
