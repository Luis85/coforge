import type { AppState } from "./types";
import type { HerdrRecord } from "./herdr";
import type { AICostTask } from "./ai-costs";
export function collectCostTasks(
  state: Pick<AppState, "jobs" | "ideas" | "projects">,
  herdr: readonly HerdrRecord[],
): AICostTask[] {
  const ideas = new Map(state.ideas.map((idea) => [idea.id, idea]));
  const projects = new Map(
    state.projects?.map((project) => [project.id, project]) ?? [],
  );
  const jobs: AICostTask[] = state.jobs.map((job) => {
    const idea = ideas.get(job.ideaId);
    const projectId = job.projectId ?? idea?.projectId ?? "";
    const project = projects.get(projectId);
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
      ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
      ...(job.model ? { model: job.model } : {}),
      ...(job.costUsd !== undefined ? { reportedUsd: job.costUsd } : {}),
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
      })),
  ];
}
