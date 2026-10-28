import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import type { ExecutionPublication } from "./execution-publication";

export class ExecutionRecovery {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly publication: ExecutionPublication,
  ) {}
  async continueSnapshot(id: string, currentRevision: string): Promise<void> {
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      if (
        !run ||
        run.state !== "attention" ||
        run.attempts.some(
          (attempt) =>
            attempt.status === "unknown" && !attempt.uncertaintyAcknowledgedAt,
        )
      )
        throw new Error(
          "Resolve uncertain provider outcomes before continuing the captured snapshot.",
        );
      run.sourceAcknowledgement = {
        revision: currentRevision,
        acknowledgedAt: this.host.now(),
      };
      run.state = "queued";
      delete run.reason;
    });
  }
  async skipInvocation(
    id: string,
    reason: string,
    acknowledgeUnknown = false,
  ): Promise<void> {
    const explanation = reason.trim();
    if (!explanation || explanation.length > 2000)
      throw new Error(
        "Provide a reason up to 2,000 characters for the missing contribution.",
      );
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      const invocation = run?.invocations[run.cursor];
      if (
        !run ||
        !invocation ||
        run.state !== "attention" ||
        !this.host.canSkip?.(structuredClone(run), structuredClone(invocation))
      )
        throw new Error(
          "The configured completion policy does not permit skipping this contribution.",
        );
      if (
        run.attempts.some(
          (attempt) =>
            attempt.status === "unknown" && !attempt.uncertaintyAcknowledgedAt,
        ) &&
        !acknowledgeUnknown
      )
        throw new Error(
          "Explicitly acknowledge the uncertain external outcome before skipping.",
        );
      if (acknowledgeUnknown)
        for (const attempt of run.attempts.filter(
          (item) => item.status === "unknown",
        ))
          attempt.uncertaintyAcknowledgedAt ??= this.host.now();
      if (run.attempts.length >= 200)
        throw new Error("The execution attempt limit was reached.");
      const attemptId = this.host.id();
      const artifactId = `artifact-${attemptId}`;
      const at = this.host.now();
      run.attempts.push({
        id: attemptId,
        invocationId: invocation.id,
        status: "responded",
        startedAt: at,
        dispatch: {
          prompt:
            "Operator-recorded missing contribution; no provider invocation.",
          inputArtifactIds: [],
        },
        artifactId,
        skipped: true,
      });
      run.artifacts.push({
        id: artifactId,
        runId: run.id,
        invocationId: invocation.id,
        attemptId,
        roundId: invocation.roundId,
        agentId: invocation.agentId,
        agentRevision: invocation.agentRevision,
        provider: invocation.provider,
        model: invocation.model,
        inputArtifactIds: [],
        createdAt: at,
        markdown: `Missing contribution: ${explanation}`,
        simulated: run.limits?.simulation ?? false,
        skipped: true,
        skipReason: explanation,
      });
      run.hasGaps = true;
      run.state = "publishing";
      delete run.reason;
      run.updatedAt = at;
    });
    await this.publication.repair(id);
  }
}
