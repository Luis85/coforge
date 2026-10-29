import {
  effectiveExecutionAllowance,
  executionAllowanceCheck,
  executionAllowancePatchCheck,
  type ExecutionAllowancePatch,
} from "../domain/execution-allowance";
import type { ExecutionJournalStore } from "./execution-journal-store";
import type { ExecutionKernelHost } from "./execution-ports";
/** Host-only operator decision; it changes no captured instructions, tools, provider, spent counter or recovery state. */
export class ExecutionAllowanceControls {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
  ) {}
  async extend(runId: string, value: ExecutionAllowancePatch): Promise<void> {
    const patch = executionAllowancePatchCheck(value);
    if (!patch.additionalInvocations && !patch.additionalExecutionMs)
      throw new Error(
        "Choose a positive invocation or automatic execution-time extension.",
      );
    if (
      patch.scopeId &&
      (!patch.additionalExecutionMs || patch.additionalInvocations)
    )
      throw new Error(
        "A scoped council extension changes execution time only. Extend invocation allowance separately.",
      );
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === runId);
      if (
        !run ||
        run.timing?.active || run.timing?.parallel?.length ||
        ["running", "completed", "cancelled"].includes(run.state)
      )
        throw new Error(
          "Pause at an action boundary and inspect retained work before extending its allowance.",
        );
      if ((run.allowanceExtensions?.length ?? 0) >= 100)
        throw new Error(
          "This run reached its allowance-decision evidence limit. Preserve the history before starting new work.",
        );
      const before = effectiveExecutionAllowance(run);
      const after = structuredClone(before);
      after.maxInvocations += patch.additionalInvocations ?? 0;
      after.executionLimitMs += patch.additionalExecutionMs ?? 0;
      if (patch.scopeId) {
        const scope = after.scopeLimits.find(
          (item) => item.id === patch.scopeId,
        );
        if (!scope)
          throw new Error(
            "Select a captured council scope before extending its time allowance.",
          );
        scope.limitMs += patch.additionalExecutionMs ?? 0;
      }
      if (
        after.maxInvocations > 100 ||
        after.executionLimitMs > 7200000 ||
        after.scopeLimits.some((item) => item.limitMs > 7200000)
      )
        throw new Error(
          "Effective allowance must remain within 100 invocations and 7,200,000 ms per run, root and council scope.",
        );
      executionAllowanceCheck(after);
      const parent = next.messaging?.outbox.find(
        (entry) => entry.message.id === run.subject.sourceId,
      )?.message;
      const rootId = parent?.rootId ?? run.id;
      const root = next.messaging?.roots.find((item) => item.id === rootId);
      if (root?.stopped)
        throw new Error(
          "A stopped conversation cannot be resumed by an allowance change.",
        );
      const rootBefore = {
        maxInvocations: root?.limits.invocations ?? before.maxInvocations,
        executionLimitMs: root?.limitExecutionMs ?? before.executionLimitMs,
      };
      const rootAfter = {
        maxInvocations:
          rootBefore.maxInvocations + (patch.additionalInvocations ?? 0),
        executionLimitMs:
          rootBefore.executionLimitMs + (patch.additionalExecutionMs ?? 0),
      };
      if (
        rootAfter.maxInvocations > 100 ||
        rootAfter.executionLimitMs > 7200000
      )
        throw new Error(
          "The inherited root allowance must remain within 100 invocations and 7,200,000 ms.",
        );
      run.allowance = after;
      run.allowanceExtensions = [
        ...(run.allowanceExtensions ?? []),
        {
          id: this.host.id(),
          operator: "streamer",
          at: this.host.now(),
          reason: patch.reason,
          before,
          after: structuredClone(after),
          rootId,
          rootBefore,
          rootAfter,
        },
      ];
      run.updatedAt = this.host.now();
      if (root) {
        root.limits.invocations = rootAfter.maxInvocations;
        root.limitExecutionMs = rootAfter.executionLimitMs;
      }
    });
  }
}
