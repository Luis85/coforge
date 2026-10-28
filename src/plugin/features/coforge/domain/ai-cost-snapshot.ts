import type { AppState } from "./types";
import type { HerdrRecord } from "./herdr";
import type { AICostTask } from "./ai-costs";
import { herdrCostAttribution, type HerdrCostTarget } from './ai-cost-attribution';
export function collectCostTasks(
  state: Pick<AppState, "jobs" | "ideas" | "projects">,
  herdr: readonly HerdrRecord[],
  managed: readonly HerdrCostTarget[] = [],
): AICostTask[] {
  const ideas = new Map(state.ideas.map((idea) => [idea.id, idea]));
  const projects = new Map(
    state.projects?.map((project) => [project.id, project]) ?? [],
  );
  const jobs: AICostTask[] = state.jobs.map((job) => {
    const idea = ideas.get(job.ideaId);
    const projectId = job.projectId ?? idea?.projectId ?? "";
    const project = projects.get(projectId);
    const captured = managed.find(record => record.jobId === job.id);
    const attribution = captured ? herdrCostAttribution(captured.settings.session, captured.target) : undefined;
    return {
      id: `job:${job.id}`,
      featureId: job.ideaId,
      featureTitle: idea?.title ?? "",
      projectId,
      projectName: project?.settings.projectName ?? "",
      provider: job.provider,
      stage: job.stage,
      status: job.status,
      startedAt: job.startedAt,
      ...(attribution ? { attribution } : {}),
      ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
      ...(job.model ? { model: job.model } : {}),
      ...(job.workflow
        ? {
            workflow: {
              runId: job.workflow.runId,
              definitionRevision: job.workflow.definitionRevision,
              stepId: job.workflow.step.id,
              stepName: job.workflow.step.name,
              attemptId: job.workflow.attemptId,
            },
          }
        : {}),
      ...(job.costUsd !== undefined ? { reportedUsd: job.costUsd } : {}),
      ...(job.usage
        ? { usage: { ...job.usage }, usageSource: "provider" as const }
        : {}),
    };
  });
  return [
    ...jobs,
    ...herdr
      .filter((record) => record.kind === "dispatch" && record.ideaId)
      .map((record) => ({
        id: `herdr:${record.id}`,
        featureId: record.ideaId ?? "",
        featureTitle: ideas.get(record.ideaId ?? "")?.title ?? "",
        projectId: record.projectId,
        projectName: projects.get(record.projectId)?.settings.projectName ?? "",
        provider: "herdr" as const,
        stage: "dispatch",
        status: record.status,
        startedAt: record.at,
        ...(record.target ? { attribution: herdrCostAttribution(record.session, record.target) } : {}),
      })),
  ];
}
