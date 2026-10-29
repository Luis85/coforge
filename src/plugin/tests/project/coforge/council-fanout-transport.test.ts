import { expect, it, vi } from "vitest";
import { runCouncilProvider } from "../../../infrastructure/coforge/council-provider";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import type { captureProcess } from "../../../infrastructure/coforge/process";
import { deferred } from "./execution-fanout-fixture";

it("overlaps native provider transports inside a scoped batch and keeps their empty workspaces/history isolated", async () => {
  const gate = new InvocationGate();
  const ready = deferred<void>();
  const release = deferred<void>();
  let active = 0;
  let peak = 0;
  let legacyEntered = false;
  const capture = vi.fn<typeof captureProcess>(async () => {
    active++;
    peak = Math.max(peak, active);
    if (active === 2) ready.resolve();
    await release.promise;
    active--;
    return JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      structured_output: { markdown: "Independent answer" },
      total_cost_usd: 0.1,
    });
  });
  const input = {
    provider: "claude" as const,
    model: "sonnet",
    instructions: "Independent opinion",
    prompt: "Same captured input",
    timeoutSeconds: 30,
    maxTurns: 2,
    maxBudgetUsd: 1,
  };
  const batch = gate.runBatch(async (lane) => {
    await Promise.all(
      ["a", "b"].map(() =>
        runCouncilProvider(input, {
          gate: lane,
          executable: "claude.exe",
          capture,
        }),
      ),
    );
  });
  await ready.promise;
  const legacy = gate.run(async () => {
    legacyEntered = true;
  });
  expect(peak).toBe(2);
  expect(legacyEntered).toBe(false);
  const workspaces = capture.mock.calls.map((call) => call[2].cwd);
  expect(new Set(workspaces).size).toBe(2);
  for (const call of capture.mock.calls) {
    expect(call[1]).toContain("--no-session-persistence");
    expect(call[1]).not.toContain("--resume");
    expect(call[1][call[1].indexOf("--tools") + 1]).toBe("");
    expect(call[2].input).toBe("Same captured input");
  }
  release.resolve();
  await batch;
  await legacy;
  expect(legacyEntered).toBe(true);
});
