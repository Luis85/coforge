import { executionBlockReason } from "../domain/execution-block";
import type { ExecutionArtifact, ExecutionRun } from "../domain/execution-run";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import { nextExecutionBoundary } from "./execution-boundaries";
import type { ExecutionTiming } from "./execution-timing";

/** Idempotent note projection and explicit destination recovery never invoke a provider. */
export class ExecutionPublication {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly timing: ExecutionTiming,
  ) {}
  async repair(id: string): Promise<void> {
    const run = this.store.find(id);
    return this.timing.measure(
      id,
      run.invocations[run.cursor],
      () => this.repairCommitted(id),
      true,
    );
  }
  private async repairCommitted(id: string): Promise<void> {
    this.store.assertLoaded();
    let run = this.store.find(id);
    if (run.projectionRecovery) {
      for (const artifactId of run.projectionRecovery.pendingArtifactIds) {
        const artifact = run.artifacts.find((item) => item.id === artifactId)!;
        await this.publishArtifact(run, artifact);
        await this.store.mutate((next) => {
          const current = next.runs.find((item) => item.id === id)!;
          if (current.projectionRecovery)
            current.projectionRecovery.pendingArtifactIds =
              current.projectionRecovery.pendingArtifactIds.filter(
                (item) => item !== artifactId,
              );
        });
      }
      await this.store.mutate((next) => {
        const current = next.runs.find((item) => item.id === id)!;
        if (
          current.projectionRecovery &&
          !current.projectionRecovery.pendingArtifactIds.length
        ) {
          current.state = current.projectionRecovery.resumeState;
          const reason = current.projectionRecovery.reason;
          delete current.projectionRecovery;
          if (reason) current.reason = reason;
          else delete current.reason;
        }
      });
      run = this.store.find(id);
      if (!run.attempts.some((item) => item.status === "responded")) return;
    }
    const attempt = [...run.attempts]
      .reverse()
      .find((item) => item.status === "responded");
    const artifact = run.artifacts.find(
      (item) => item.id === attempt?.artifactId,
    );
    if (!attempt || !artifact)
      throw new Error(
        "There is no committed contribution awaiting publication.",
      );
    await this.publishArtifact(run, artifact);
    await this.store.mutate((next) => {
      const current = next.runs.find((item) => item.id === id)!;
      const saved = current.attempts.find((item) => item.id === attempt.id)!;
      if (saved.status === "published") return;
      saved.status = "published";
      current.cursor++;
      if (current.state !== "cancelled")
        current.state =
          current.cursor === current.invocations.length &&
          !nextExecutionBoundary(current)
            ? "completed"
            : "queued";
      delete current.reason;
      current.updatedAt = this.host.now();
    });
  }
  private async publishArtifact(
    run: ExecutionRun,
    artifact: ExecutionArtifact,
  ): Promise<void> {
    try {
      await this.host.publish(structuredClone(run), structuredClone(artifact));
    } catch (error) {
      await this.store.mutate((next) => {
        const current = next.runs.find((item) => item.id === run.id)!;
        current.reason = executionBlockReason(
          error,
          "Contribution retained. Repair publication after resolving a missing source, note conflict or storage error.",
        );
        current.updatedAt = this.host.now();
      });
      throw error;
    }
  }
  async reassignProjection(id: string, sourceId: string): Promise<void> {
    this.store.assertLoaded();
    const run = this.store.find(id);
    if (!this.host.validateProjectionTarget)
      throw new Error(
        "Publication reassignment is unavailable until the host can validate its private destination.",
      );
    await this.host.validateProjectionTarget(structuredClone(run), sourceId);
    await this.store.mutate((next) => {
      const current = next.runs.find((item) => item.id === id)!;
      if (
        current.state === "running" ||
        current.state !== run.state ||
        current.cursor !== run.cursor ||
        current.projectionRecovery
      )
        throw new Error(
          "Pause active work and finish existing publication recovery before reassigning the destination.",
        );
      current.projectionDestinations = [
        ...new Set([
          ...(current.projectionDestinations ?? []),
          current.projectionTarget?.sourceId ?? current.subject.sourceId,
        ]),
      ];
      current.projectionTarget = { sourceId, acknowledgedAt: this.host.now() };
      current.projectionRecovery = {
        resumeState: current.state,
        pendingArtifactIds: current.artifacts.map((artifact) => artifact.id),
        ...(current.reason ? { reason: current.reason } : {}),
      };
      current.state = "publishing";
      delete current.reason;
    });
    await this.repair(id);
  }
}
