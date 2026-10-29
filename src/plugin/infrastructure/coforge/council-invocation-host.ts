import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import type {
  InvocationGate,
  InvocationLane,
} from "../../features/coforge/application/invocation-gate";
import type { StudioService } from "../../features/coforge/application/studio";
import type {
  ExecutionRun,
  ExecutionInvocation,
  ExecutionAttempt,
  ExecutionResponse,
} from "../../features/coforge/domain/execution-run";
import type { CouncilMessagingModule } from "./council-messaging-module";
import { runCouncilProvider } from "./council-provider";
import type { ExecutionTimingHooks } from "../../features/coforge/application/execution-timing";
import type { Timers } from "../../features/coforge/application/ports";

/** Native invocation resources are disposed independently of durable run evidence. */
export class CouncilInvocationHost {
  private readonly cancellations = new Map<
    string,
    { runId: string; controller: AbortController }
  >();
  private readonly batches = new Map<string, InvocationLane>();
  constructor(
    private readonly studio: Pick<StudioService, "integration">,
    private readonly gate: InvocationGate,
    private readonly kernel: () => Pick<ExecutionKernel, "recordTelemetry">,
    private readonly messaging: () => Pick<
      CouncilMessagingModule,
      "prepare" | "allowedRecipients" | "invalidateAuthority"
    >,
    private readonly recheck?: (
      run: ExecutionRun,
      invocation: ExecutionInvocation,
    ) => Promise<void>,
    private readonly timers?: Pick<Timers, "setInterval" | "clearInterval">,
  ) {}
  async invoke(
    run: ExecutionRun,
    invocation: ExecutionInvocation,
    attempt: ExecutionAttempt,
    timing?: ExecutionTimingHooks,
  ): Promise<ExecutionResponse> {
    const controller = new AbortController();
    this.cancellations.set(attempt.id, { runId: run.id, controller });
    try {
      const prepare = () => this.messaging().prepare(run, invocation, attempt);
      await (timing?.action?.(prepare) ?? prepare());
      const result = await runCouncilProvider(
        {
          provider: invocation.provider,
          model: invocation.model,
          instructions: invocation.instructions,
          output: invocation.output,
          maxArtifactCharacters: invocation.maxArtifactCharacters,
          prompt: attempt.dispatch.prompt,
          timeoutSeconds: run.limits?.timeoutSeconds ?? 180,
          maxTurns: run.limits?.maxTurns ?? 12,
          maxBudgetUsd: run.limits?.maxBudgetUsd ?? 1,
          signal: controller.signal,
          allowedRecipients: this.messaging().allowedRecipients(attempt.id),
        },
        {
          gate: this.batches.get(run.id) ?? this.gate,
          timing,
          timers: this.timers,
          beforeInvoke: async () => {
            await this.recheck?.(run, invocation);
            await prepare();
          },
          executable: this.studio.integration().claudeBin,
          telemetry: (usage, cost) =>
            this.kernel().recordTelemetry(run.id, attempt.id, usage, cost),
        },
      );
      try {
        await (timing?.action?.(prepare, true) ?? prepare());
      } catch {
        this.messaging().invalidateAuthority(attempt.id);
      }
      return result;
    } finally {
      this.cancellations.delete(attempt.id);
    }
  }
  cancel(id: string): void {
    for (const active of this.cancellations.values())
      if (active.runId === id) active.controller.abort();
  }
  batch(id: string, work: () => Promise<void>): Promise<void> {
    if (this.batches.has(id))
      return Promise.reject(
        new Error("A provider batch already owns this run."),
      );
    return this.gate.runBatch(async (lane) => {
      this.batches.set(id, lane);
      try {
        await work();
      } finally {
        this.batches.delete(id);
      }
    });
  }
  dispose(): void {
    for (const active of this.cancellations.values()) active.controller.abort();
  }
}
