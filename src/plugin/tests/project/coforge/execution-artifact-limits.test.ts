import { describe, expect, it, vi } from "vitest";
import { ExecutionKernel } from "../../../features/coforge/application/execution-kernel";
import { emptyExecutionJournal } from "../../../features/coforge/domain/execution-run";
import { runCouncilProvider } from "../../../infrastructure/coforge/council-provider";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import type { captureProcess } from "../../../infrastructure/coforge/process";

describe("captured per-invocation artifact allowance", () => {
  it("rejects an oversized final contribution before artifact acceptance even when no downstream round exists", async () => {
    let journal = emptyExecutionJournal();
    let calls = 0;
    const kernel = new ExecutionKernel({
      journal: {
        load: async () => journal,
        save: async (next) => {
          journal = structuredClone(next);
        },
      },
      now: () => "2026-10-28T12:00:00.000Z",
      id: () => "attempt",
      assertEligible: async () => undefined,
      resolveInvocation: () => ({ prompt: "request", inputArtifactIds: [] }),
      invoke: async () => {
        calls++;
        return { markdown: "x".repeat(101), simulated: false };
      },
      publish: async () => undefined,
    });
    await kernel.load();
    await kernel.admit({
      id: "run",
      submissionKey: "key",
      projectId: "project",
      teamId: "team",
      context: "",
      subject: {
        kind: "note",
        sourceId: "source",
        revision: "r1",
        markdown: "Request",
      },
      invocations: [
        {
          id: "last",
          roundId: "last",
          agentId: "agent",
          agentRevision: "r1",
          provider: "claude",
          model: "sonnet",
          instructions: "Analyze",
          access: "none",
          inputRoundIds: [],
          maxArtifactCharacters: 100,
        },
      ],
    });
    kernel.resume();
    await expect(kernel.step("run")).rejects.toThrow("artifact");
    expect(calls).toBe(1);
    expect(journal.runs[0]?.artifacts).toEqual([]);
    expect(journal.runs[0]?.cursor).toBe(0);
  });
  it("limits the native provider schema and validates the complete returned Markdown without truncation", async () => {
    const capture = vi.fn<typeof captureProcess>(async () =>
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { markdown: "x".repeat(101) },
      }),
    );
    await expect(
      runCouncilProvider(
        {
          provider: "claude",
          model: "sonnet",
          instructions: "Analyze",
          prompt: "Request",
          timeoutSeconds: 30,
          maxTurns: 2,
          maxBudgetUsd: 1,
          maxArtifactCharacters: 100,
        },
        { gate: new InvocationGate(), executable: "claude.exe", capture },
      ),
    ).rejects.toThrow("artifact");
    const args = capture.mock.calls[0]?.[1] ?? [];
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1]!)).toMatchObject({
      properties: { markdown: { maxLength: 100 } },
    });
  });
});
