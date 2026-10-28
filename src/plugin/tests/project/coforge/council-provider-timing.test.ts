import { afterEach, expect, it, vi } from "vitest";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { runCouncilProvider } from "../../../infrastructure/coforge/council-provider";
import type { ExecutionTimingHooks } from "../../../features/coforge/application/execution-timing";
import * as provider from "../../../infrastructure/coforge/council-provider";
import { CouncilInvocationHost } from "../../../infrastructure/coforge/council-invocation-host";
import { defaultIntegration } from "../../../features/coforge/domain/seed";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";
import { nodeTimers } from "./memory-storage";
afterEach(() => {
  vi.useRealTimers();
});
const input = {
  provider: "claude" as const,
  model: "sonnet",
  instructions: "Analyze.",
  prompt: "Source",
  timeoutSeconds: 30,
  maxTurns: 1,
  maxBudgetUsd: 1,
};
it("rechecks live authority after waiting for the slot and refuses capture after revocation", async () => {
  const gate = new InvocationGate();
  let release: () => void = () => undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const occupied = gate.run(() => waiting);
  let permitted = true;
  const capture = vi.fn(async () => "Unexpected provider call.");
  const beforeInvoke = vi.fn(async () => {
    if (!permitted) throw new Error("The grant was revoked.");
  });
  const next = runCouncilProvider(input, {
    gate,
    executable: "claude",
    capture,
    beforeInvoke,
  });
  const rejected = expect(next).rejects.toThrow("revoked");
  await Promise.resolve();
  await Promise.resolve();
  expect(beforeInvoke).not.toHaveBeenCalled();
  permitted = false;
  release();
  await occupied;
  await rejected;
  expect(capture).not.toHaveBeenCalled();
});
it("starts the execution meter only after the shared provider slot is acquired", async () => {
  const gate = new InvocationGate();
  let release: () => void = () => undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const occupied = gate.run(() => waiting);
  const timing: ExecutionTimingHooks = {
    remainingMs: 5000,
    start: vi.fn(async () => undefined),
    checkpoint: async () => 5000,
    stop: vi.fn(async () => undefined),
  };
  const second = runCouncilProvider(
    { ...input, provider: "demo" },
    { gate, executable: "", timing, timers: nodeTimers() },
  );
  await Promise.resolve();
  await Promise.resolve();
  expect(timing.start).not.toHaveBeenCalled();
  release();
  await occupied;
  await second;
  expect(timing.start).toHaveBeenCalledOnce();
  expect(timing.stop).toHaveBeenCalledOnce();
});
it("clamps native timeouts to remaining active time and aborts when periodic metering exhausts it", async () => {
  vi.useFakeTimers();
  let started: () => void = () => undefined;
  const captureStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const timing: ExecutionTimingHooks = {
    remainingMs: 500,
    start: async () => undefined,
    checkpoint: vi.fn().mockResolvedValueOnce(500).mockResolvedValue(0),
    stop: vi.fn(async () => undefined),
  };
  let timeout = 0;
  const result = runCouncilProvider(input, {
    gate: new InvocationGate(),
    executable: "claude",
    timing,
    timers: nodeTimers(),
    capture: async (_exe, _args, options) => {
      timeout = options.timeoutMs!;
      started();
      return new Promise<string>((_resolve, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => reject(new Error("Capture cancelled.")),
          { once: true },
        );
      });
    },
  });
  const rejected = expect(result).rejects.toMatchObject({
    code: "execution-time",
  });
  await captureStarted;
  expect(timeout).toBe(500);
  await vi.advanceTimersByTimeAsync(1000);
  await rejected;
  expect(timing.checkpoint).toHaveBeenCalled();
  expect(timing.stop).toHaveBeenCalledOnce();
});
it("retains a returned provider response and usage when the postresponse policy check fails", async () => {
  const result = {
    markdown: "A valid retained response.",
    simulated: false,
    costUsd: 0.3,
  };
  const call = vi
    .spyOn(provider, "runCouncilProvider")
    .mockResolvedValue(result);
  try {
    const prepare = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("A grant was revoked."));
    const messages = {
      prepare,
      allowedRecipients: () => ["agent-b"],
      invalidateAuthority: vi.fn(),
    };
    const invocation = {
      id: "invocation",
      roundId: "opinions",
      agentId: "agent",
      agentRevision: "r1",
      provider: "claude" as const,
      model: "sonnet",
      instructions: "Analyze.",
      access: "none" as const,
      inputRoundIds: [],
    };
    const run: ExecutionRun = {
      id: "run",
      submissionKey: "key",
      subject: {
        kind: "note",
        sourceId: "source",
        revision: "r1",
        markdown: "Source",
      },
      projectId: "project",
      teamId: "team",
      context: "",
      invocations: [invocation],
      cursor: 0,
      state: "running",
      attempts: [],
      artifacts: [],
      createdAt: "2026-10-28T12:00:00Z",
      updatedAt: "2026-10-28T12:00:00Z",
    };
    const host = new CouncilInvocationHost(
      { integration: defaultIntegration },
      new InvocationGate(),
      () => ({ recordTelemetry: async () => undefined }),
      () => messages,
    );
    expect(
      await host.invoke(run, invocation, {
        id: "attempt",
        invocationId: invocation.id,
        status: "dispatching",
        startedAt: run.createdAt,
        dispatch: { prompt: "Source", inputArtifactIds: [] },
      }),
    ).toEqual(result);
    expect(messages.invalidateAuthority).toHaveBeenCalledWith("attempt");
  } finally {
    call.mockRestore();
  }
});
