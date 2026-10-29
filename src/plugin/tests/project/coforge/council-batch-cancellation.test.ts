import { expect, it, vi } from "vitest";
import { CouncilInvocationHost } from "../../../infrastructure/coforge/council-invocation-host";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { defaultIntegration } from "../../../features/coforge/domain/seed";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";
import { runCouncilProvider } from "../../../infrastructure/coforge/council-provider";
import { deferred, fanoutFixture } from "./execution-fanout-fixture";
vi.mock("../../../infrastructure/coforge/council-provider", () => ({
  runCouncilProvider: vi.fn(),
}));

it.each(["cancel", "dispose"] as const)(
  "%s aborts every native member rather than losing earlier controllers",
  async (action) => {
    const ready = deferred<void>();
    const signals: AbortSignal[] = [];
    vi.mocked(runCouncilProvider).mockImplementation((input, host) =>
      host.gate.run(async () => {
        if (!input.signal) throw new Error("Missing cancellation signal");
        signals.push(input.signal);
        if (signals.length === 2) ready.resolve();
        await new Promise<void>((_yes, no) =>
          input.signal!.addEventListener(
            "abort",
            () => no(new Error("cancelled")),
            { once: true },
          ),
        );
        return { markdown: "unused", simulated: true };
      }),
    );
    const gate = new InvocationGate();
    const native = new CouncilInvocationHost(
      { integration: defaultIntegration },
      gate,
      () => ({ recordTelemetry: async () => {} }),
      () => ({
        prepare: async () => {},
        allowedRecipients: () => [],
        agentRecipients: () => [],
        invalidateAuthority: () => {},
      }),
    );
    const f = fanoutFixture();
    const run: ExecutionRun = {
      ...f.admission,
      cursor: 0,
      state: "running",
      attempts: [],
      artifacts: [],
      createdAt: "2026-10-28T12:00:00Z",
      updatedAt: "2026-10-28T12:00:00Z",
    };
    const batch = native.batch(run.id, async () => {
      const results = await Promise.allSettled(
        run.invocations
          .slice(0, 2)
          .map((invocation) =>
            native.invoke(run, invocation, {
              id: `attempt-${invocation.id}`,
              invocationId: invocation.id,
              status: "dispatching",
              startedAt: run.createdAt,
              dispatch: { prompt: "Captured", inputArtifactIds: [] },
            }),
          ),
      );
      expect(results.every((result) => result.status === "rejected")).toBe(
        true,
      );
    });
    await ready.promise;
    if (action === "cancel") native.cancel(run.id);
    else native.dispose();
    await batch;
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(await gate.run(async () => "released")).toBe("released");
  },
);
