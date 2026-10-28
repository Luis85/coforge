import { describe, expect, it } from "vitest";
import { reportedClaudeUsage } from "../../../features/coforge/application/claude-protocol";
import {
  stageUsageCheck,
  tokenSummary,
} from "../../../features/coforge/domain/ai-usage";
import type { AICostTask } from "../../../features/coforge/domain/ai-costs";
const task = (id: string): AICostTask => ({
  id,
  featureId: "CF-1",
  featureTitle: "Feature",
  projectId: "CFP-001",
  projectName: "Project",
  provider: "claude",
  stage: "screen",
  status: "failed",
  startedAt: "2026-10-28T00:00:00Z",
});
describe("provider token usage", () => {
  it("captures counters from a failed SDK result and keeps absent counters distinct from zero", () => {
    const raw = JSON.stringify({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
      usage: {
        input_tokens: 0,
        output_tokens: 25,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 7,
        server_tool_use: {},
      },
    });
    expect(reportedClaudeUsage(raw)).toEqual({
      inputTokens: 0,
      outputTokens: 25,
      cacheReadInputTokens: 100,
      cacheCreationInputTokens: 7,
    });
    expect(
      reportedClaudeUsage(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          usage: { output_tokens: 0 },
        }),
      ),
    ).toEqual({ outputTokens: 0 });
    expect(
      reportedClaudeUsage(
        JSON.stringify({ type: "result", subtype: "success", is_error: false }),
      ),
    ).toBeUndefined();
    expect(
      reportedClaudeUsage(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          usage: { input_tokens: 2, output_tokens: 3 },
          modelUsage: { model: { inputTokens: 200, outputTokens: 300 } },
        }),
      ),
    ).toEqual({ inputTokens: 2, outputTokens: 3 });
    expect(
      reportedClaudeUsage(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          usage: {
            input_tokens: 2,
            output_tokens: 0,
            cache_read_input_tokens: null,
          },
        }),
      ),
    ).toEqual({ inputTokens: 2, outputTokens: 0 });
    expect(
      reportedClaudeUsage(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          usage: { input_tokens: -2, output_tokens: 3 },
        }),
      ),
    ).toBeUndefined();
    for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "12", null])
      expect(() => stageUsageCheck({ inputTokens: invalid })).toThrow();
  });
  it("sums known counters exactly per task without mixing cache or simulation usage into uncached input", () => {
    const totals = tokenSummary([
      {
        ...task("one"),
        usage: { inputTokens: 12, outputTokens: 3, cacheReadInputTokens: 100 },
        usageSource: "provider",
      },
      {
        ...task("two"),
        usage: { inputTokens: 0, outputTokens: 4, cacheCreationInputTokens: 8 },
        usageSource: "provider",
      },
      task("unknown"),
      { ...task("herdr"), provider: "herdr" },
      {
        ...task("demo"),
        provider: "demo",
        usage: { inputTokens: 999, outputTokens: 999 },
        usageSource: "provider",
      },
    ]);
    expect(totals.inputTokens).toBe(12n);
    expect(totals.outputTokens).toBe(7n);
    expect(totals.cacheReadInputTokens).toBe(100n);
    expect(totals.cacheCreationInputTokens).toBe(8n);
    expect(totals.inputTasks).toBe(2);
    expect(totals.outputTasks).toBe(2);
    expect(totals.realTasks).toBe(4);
    expect(tokenSummary([task("old")]).inputTokens).toBeUndefined();
    expect(
      tokenSummary([
        { ...task("zero"), usage: { inputTokens: 0 }, usageSource: "provider" },
      ]).inputTokens,
    ).toBe(0n);
    expect(
      tokenSummary([
        {
          ...task("complete"),
          usage: {
            inputTokens: 2,
            outputTokens: 3,
            cacheReadInputTokens: 5,
            cacheCreationInputTokens: 7,
          },
          usageSource: "provider",
        },
      ]).totalInputTokens,
    ).toBe(14n);
    const large = tokenSummary([
      {
        ...task("large1"),
        usage: { inputTokens: Number.MAX_SAFE_INTEGER },
        usageSource: "provider",
      },
      {
        ...task("large2"),
        usage: { inputTokens: Number.MAX_SAFE_INTEGER },
        usageSource: "provider",
      },
    ]);
    expect(large.inputTokens).toBe(BigInt(Number.MAX_SAFE_INTEGER) * 2n);
  });
});
