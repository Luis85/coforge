import { describe, expect, it, vi } from "vitest";
import { runCouncilProvider } from "../../../infrastructure/coforge/council-provider";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import type { captureProcess } from "../../../infrastructure/coforge/process";
const input = {
  provider: "claude" as const,
  model: "sonnet",
  instructions: "Analyze",
  prompt: "Request",
  timeoutSeconds: 30,
  maxTurns: 2,
  maxBudgetUsd: 1,
};
describe("native council telemetry provenance", () => {
  it("rejects model-authored usage and cost fields when the real CLI envelope reports neither", async () => {
    const capture = vi.fn<typeof captureProcess>(async () =>
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: {
          markdown: "Proposal",
          costUsd: 123,
          usage: { inputTokens: 999999, outputTokens: 999999 },
        },
      }),
    );
    const telemetry = vi.fn(async () => undefined);
    await expect(
      runCouncilProvider(input, {
        gate: new InvocationGate(),
        executable: "claude.exe",
        capture,
        telemetry,
      }),
    ).rejects.toThrow("not allowed");
    expect(telemetry).not.toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 999999 }),
      123,
    );
  });
  it("returns only CLI-envelope counters and leaves absent provider telemetry unavailable", async () => {
    const capture = vi.fn<typeof captureProcess>(async () =>
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { markdown: "Proposal" },
        total_cost_usd: 0.02,
        usage: { input_tokens: 12, output_tokens: 3 },
      }),
    );
    const host = {
      gate: new InvocationGate(),
      executable: "claude.exe",
      capture,
    };
    expect(await runCouncilProvider(input, host)).toMatchObject({
      costUsd: 0.02,
      usage: { inputTokens: 12, outputTokens: 3 },
    });
    capture.mockResolvedValue(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { markdown: "Proposal" },
      }),
    );
    const unavailable = await runCouncilProvider(input, host);
    expect(unavailable.costUsd).toBeUndefined();
    expect(unavailable.usage).toBeUndefined();
  });
});
