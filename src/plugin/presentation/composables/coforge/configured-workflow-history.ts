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
  const byAttempt = new Map(jobs.flatMap(job => job.workflow ? [[JSON.stringify([job.ideaId, job.workflow.runId, job.workflow.attemptId]), job] as const] : []));
  const current = ideas.flatMap((idea) =>
    [
      ...(idea.workflowHistory ?? []),
      ...(idea.workflowRun ? [idea.workflowRun] : []),
      ...(idea.polishingRuns ?? []).map(pass => pass.workflow),
    ].flatMap((run) =>
      run.attempts.map((attempt) => {
        const linked = attempt.jobId ? byId.get(attempt.jobId) : undefined;
        const job = linked?.ideaId === idea.id && (!linked.workflow || linked.workflow.runId === run.id && linked.workflow.attemptId === attempt.id) ? linked : byAttempt.get(JSON.stringify([idea.id, run.id, attempt.id]));
        const step = run.definition.steps.find(
          (step) => step.id === attempt.stepId,
        );
        const councilName = step?.kind === 'council' ? run.councilBindings?.find(item => item.stepId === step.id)?.binding.councilName ?? step.councilId : '';
        return {
          id: attempt.id,
          ideaId: idea.id,
          canOpenIdea: true,
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
              ...(job?.error && job.error !== attempt.error ? [job.error] : []),
            ].join("\n") || "No additional notes.",
        };
      }),
    ),
  );
  const represented = new Set(current.map(row => row.jobId).filter(Boolean));
  const legacy = jobs
    .filter((job) => !job.workflow || !represented.has(job.id))
    .map((job) => ({
      id: job.id,
      ideaId: job.ideaId,
      canOpenIdea: ideas.some(idea => idea.id === job.ideaId),
      councilRunId: '', councilProjectId: job.projectId ?? '', councilName: '',
      status: job.status,
      stageLabel: job.workflow?.step.name ?? STAGE_LABELS[job.stage],
      providerLabel:
        job.workflow && job.provider !== 'mcp' ? configuredAgentLabel(job.workflow.step, true) : job.provider === "demo"
          ? "Simulation"
          : job.provider === "mcp" ? "External MCP client · model not reported" : `${job.provider === 'codex' ? 'Codex' : job.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${job.model ?? "model not recorded"}`,
      time: clock(job.startedAt),
      at: job.startedAt,
      canCancel: isActiveJob(job) || Boolean(job.durable && job.durable.acknowledged !== true),
      jobId: job.id,
      costText:
        job.costUsd === undefined
          ? ""
          : `Reported cost: $${job.costUsd.toFixed(4)}`,
      log:
        [...(job.workflow ? ['Request/run metadata is unavailable. This row shows retained attempt evidence; restore the original metadata before restarting.'] : []), ...job.logs, ...(job.error ? [job.error] : [])].join("\n") ||
        "No additional notes.",
    }));
  return [...current, ...legacy].sort((a, b) => b.at.localeCompare(a.at));
}
