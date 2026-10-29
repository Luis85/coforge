import { describe, expect, it, vi } from "vitest";
import { runCouncilProvider } from "../../../infrastructure/coforge/council-provider";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import type { captureProcess } from "../../../infrastructure/coforge/process";

describe("typed note provider invocation", () => {
  it("enforces scoped CoForge MCP action tools with no native tools, reused history or invented Idea", async () => {
    const capture = vi.fn<typeof captureProcess>(async () =>
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { markdown: "# Independent opinion" },
        total_cost_usd: 0.01,
        usage: { input_tokens: 12, output_tokens: 5 },
      }),
    );
    const result = await runCouncilProvider(
      {
        provider: "claude",
        model: "sonnet",
        instructions: "Assess the proposal",
        prompt: JSON.stringify({
          subject: { kind: "note", sourceId: "note-1", markdown: "A proposal" },
        }),
        timeoutSeconds: 30,
        maxTurns: 2,
        maxBudgetUsd: 0.1,
      },
      { gate: new InvocationGate(), executable: "claude.exe", capture },
    );
    expect(result).toMatchObject({
      markdown: "# Independent opinion",
      simulated: false,
      costUsd: 0.01,
      usage: { inputTokens: 12, outputTokens: 5 },
    });
    const args = capture.mock.calls[0]?.[1] ?? [];
    expect(args).toContain("--restricted");
    expect(args).toContain("--no-session-persistence");
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args).toContain('--strict-mcp-config');
    expect(args[args.indexOf('--mcp-config') + 1]).toMatch(/coforge-only-mcp\.json$/u);
    expect(args[args.indexOf('--allowedTools') + 1]).toContain('mcp__coforge__coforge_invocation');
    expect(args).not.toContain("--resume");
    expect(args).not.toContain("--continue");
  });

  it("marks simulation, rejects unsupported isolation and rejects oversized output without truncation", async () => {
    const capture = vi.fn<typeof captureProcess>(async () => "");
    const host = {
      gate: new InvocationGate(),
      executable: "claude.exe",
      capture,
    };
    const input = {
      provider: "demo" as const,
      model: "sonnet",
      instructions: "Assess",
      prompt: "proposal",
      timeoutSeconds: 30,
      maxTurns: 2,
      maxBudgetUsd: 0.1,
    };
    expect(await runCouncilProvider(input, host)).toMatchObject({
      simulated: true,
    });
    expect(capture).not.toHaveBeenCalled();
    await expect(
      runCouncilProvider({ ...input, provider: "herdr" }, host),
    ).rejects.toThrow("isolated");
    capture.mockResolvedValue(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { markdown: "x".repeat(16001) },
      }),
    );
    await expect(
      runCouncilProvider({ ...input, provider: "claude" }, host),
    ).rejects.toThrow();
  });
  it('uses the existing structured plan schema and rejects prose relabeling while keeping tools disabled', async () => {
    const capture = vi.fn<typeof captureProcess>(async () => JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
      structured_output: { summary: 'Validated plan', steps: ['Inspect code'], acceptanceCriteria: ['Review actual diff'], risks: [] } }));
    const input = { provider: 'claude' as const, model: 'sonnet', instructions: 'Plan', prompt: 'Complete council result', timeoutSeconds: 30, maxTurns: 2, maxBudgetUsd: 0.1, output: 'plan' as const };
    const result = await runCouncilProvider(input, { gate: new InvocationGate(), executable: 'claude.exe', capture });
    expect(result.plan?.summary).toBe('Validated plan'); expect(result.markdown).toContain('Inspect code');
    const args = capture.mock.calls[0]?.[1] ?? []; expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1]!)).toMatchObject({ required: ['summary', 'steps', 'acceptanceCriteria', 'risks'] });
    capture.mockResolvedValue(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { markdown: 'Unvalidated prose' } }));
    await expect(runCouncilProvider(input, { gate: new InvocationGate(), executable: 'claude.exe', capture })).rejects.toThrow();
  });
});
