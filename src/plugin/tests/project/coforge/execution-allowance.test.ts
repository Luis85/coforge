import { describe, expect, it } from "vitest";
import {
  ExecutionKernel,
  type ExecutionKernelHost,
} from "../../../features/coforge/application/execution-kernel";
import {
  emptyExecutionJournal,
  type ExecutionAdmission,
} from "../../../features/coforge/domain/execution-run";
import { effectiveExecutionAllowance } from "../../../features/coforge/domain/execution-allowance";
import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
} from "../../../features/coforge/domain/execution-outbox";
import type { MessageAuthority } from "../../../features/coforge/domain/team-messages";
const at = "2026-10-28T12:00:00.000Z";
function authority(
  runId: string,
  attemptId: string,
  cap: number,
): MessageAuthority {
  return {
    rootId: runId,
    runId,
    attemptId,
    senderId: "agent",
    projectId: "project",
    teamId: "team",
    threadId: runId,
    now: at,
    depth: 0,
    activeAncestors: [],
    allowedRecipients: ["child"],
    stopped: false,
    limits: { depth: 3, descendants: 10, messages: 10, invocations: cap },
    usage: { descendants: 0, messages: 0, invocations: 1 },
    recipients: [
      {
        id: "child",
        kind: "agent",
        projectId: "project",
        teamId: "team",
        enabled: true,
        expectedInvocations: 1,
      },
    ],
  };
}
function fixture() {
  let journal = emptyExecutionJournal();
  let clock = 0;
  let ids = 0;
  let calls = 0;
  const host: ExecutionKernelHost = {
    journal: {
      load: async () => journal,
      save: async (next) => {
        journal = structuredClone(next);
      },
    },
    now: () => at,
    id: () => `evidence-${++ids}`,
    monotonicMs: () => clock,
    assertEligible: async () => undefined,
    resolveInvocation: () => ({ prompt: "Request", inputArtifactIds: [] }),
    publish: async () => undefined,
    invoke: async (_run, _invocation, _attempt, timing) => {
      await timing?.start();
      clock += 100;
      await timing?.stop();
      if (++calls <= 2) throw new Error("unknown attempt");
      return {
        markdown: "Result",
        simulated: false,
        messageDrafts: [
          { purpose: "request", recipientId: "child", body: "Child work" },
        ],
      };
    },
    commitMessages: (next, run, attempt, drafts) => {
      next.messaging = commitExecutionMessages(
        next.messaging ?? emptyExecutionMessagingState(),
        authority(
          run.id,
          attempt.id,
          effectiveExecutionAllowance(run).maxInvocations,
        ),
        drafts,
      );
    },
  };
  const input: ExecutionAdmission = {
    id: "run",
    submissionKey: "key",
    projectId: "project",
    teamId: "team",
    context: "",
    definitionSnapshot: "sealed configuration",
    subject: {
      kind: "note",
      sourceId: "source",
      revision: "r1",
      markdown: "Request",
    },
    limits: {
      timeoutSeconds: 180,
      maxTurns: 12,
      maxBudgetUsd: 1,
      simulation: false,
      maxInvocations: 2,
      executionLimitMs: 500,
    },
    invocations: [
      {
        id: "review",
        roundId: "review",
        agentId: "agent",
        agentRevision: "r1",
        provider: "claude",
        model: "sonnet",
        instructions: "Pinned instructions",
        access: "none",
        inputRoundIds: [],
      },
    ],
  };
  const kernel = new ExecutionKernel(host);
  return {
    kernel,
    host,
    input,
    get journal() {
      return journal;
    },
    get calls() {
      return calls;
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
}
describe("audited operator allowance extensions", () => {
  it("retains spent work and unknown evidence, stays paused, and initializes first messaging root from the effective extension", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(f.input);
    f.kernel.resume();
    await expect(f.kernel.step("run")).rejects.toThrow("unknown");
    await f.kernel.retry("run", true);
    await expect(f.kernel.step("run")).rejects.toThrow("unknown");
    f.kernel.pause();
    expect(f.journal.messaging).toBeUndefined();
    expect(f.journal.runs[0]?.timing?.usedMs).toBe(200);
    await f.kernel.extendAllowance("run", {
      additionalInvocations: 2,
      additionalExecutionMs: 500,
      reason:
        "Inspected both original attempts and approved one additional branch.",
    });
    const extended = f.journal.runs[0]!;
    expect(extended.state).toBe("attention");
    expect(f.kernel.isPaused).toBe(true);
    expect(f.calls).toBe(2);
    expect(extended.attempts[1]?.uncertaintyAcknowledgedAt).toBeUndefined();
    expect(extended.timing?.usedMs).toBe(200);
    expect(extended.definitionSnapshot).toBe("sealed configuration");
    expect(extended.limits).toMatchObject({
      maxInvocations: 2,
      executionLimitMs: 500,
    });
    expect(extended.allowanceExtensions?.[0]).toMatchObject({
      operator: "streamer",
      before: { maxInvocations: 2, executionLimitMs: 500 },
      after: { maxInvocations: 4, executionLimitMs: 1000 },
    });
    await f.kernel.retry("run", true);
    f.kernel.resume();
    await f.kernel.step("run");
    expect(f.journal.messaging?.roots[0]).toMatchObject({
      limits: { invocations: 4 },
      usage: { invocations: 4 },
      usedExecutionMs: 300,
      limitExecutionMs: 1000,
    });
    expect(f.calls).toBe(3);
  });
  it("keeps a stricter council scope until that scope is explicitly extended, without resetting its spent time", async () => {
    const f = fixture();
    f.input.invocations = ["one", "two"].map((id) => ({
      ...f.input.invocations[0]!,
      id,
      executionScope: { id: "council", limitMs: 100 },
    }));
    f.input.limits!.maxInvocations = 4;
    f.host.invoke = async (_run, _invocation, _attempt, timing) => {
      await timing?.start();
      f.advance(100);
      await timing?.stop();
      return { markdown: "Result", simulated: false };
    };
    await f.kernel.load();
    await f.kernel.admit(f.input);
    f.kernel.resume();
    await f.kernel.step("run");
    await expect(f.kernel.step("run")).rejects.toThrow("execution allowance");
    await f.kernel.extendAllowance("run", {
      additionalExecutionMs: 100,
      reason: "Root extension only",
    });
    await f.kernel.retry("run");
    await expect(f.kernel.step("run")).rejects.toThrow("execution allowance");
    await f.kernel.extendAllowance("run", {
      additionalExecutionMs: 100,
      scopeId: "council",
      reason: "Reviewed and extended this council scope",
    });
    expect(f.journal.runs[0]?.state).toBe("attention");
    await f.kernel.retry("run");
    await f.kernel.step("run");
    expect(f.journal.runs[0]?.state).toBe("completed");
    expect(f.journal.runs[0]?.timing?.scopes).toEqual([
      { id: "council", usedMs: 200 },
    ]);
  });
  it("rejects unbounded, empty and unknown-scope extensions atomically without dispatch", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(f.input);
    const before = f.journal.revision;
    await expect(
      f.kernel.extendAllowance("run", {
        additionalInvocations: 99,
        reason: "Too many calls",
      }),
    ).rejects.toThrow("100 invocations");
    await expect(
      f.kernel.extendAllowance("run", {
        additionalExecutionMs: 7200000,
        reason: "Too much time",
      }),
    ).rejects.toThrow("7,200,000");
    await expect(
      f.kernel.extendAllowance("run", { reason: "No resource change" }),
    ).rejects.toThrow("positive");
    await expect(
      f.kernel.extendAllowance("run", {
        scopeId: "unknown",
        additionalExecutionMs: 1,
        reason: "Unknown scope",
      }),
    ).rejects.toThrow("captured council");
    expect(f.journal.revision).toBe(before);
    expect(f.journal.runs[0]?.allowanceExtensions).toBeUndefined();
    expect(f.calls).toBe(0);
  });
  it("extends a child allowance without resetting earlier root reservations or measured execution", async () => {
    const f = fixture();
    await f.kernel.load();
    const parent = authority("parent", "parent-attempt", 5);
    parent.usage.invocations = 2;
    await f.kernel.updateMessaging((previous) =>
      commitExecutionMessages(previous, parent, [
        { purpose: "request", recipientId: "child", body: "Child request" },
      ]),
    );
    await f.kernel.updateMessaging((previous) => {
      previous.roots[0]!.usedExecutionMs = 250;
      previous.roots[0]!.limitExecutionMs = 1000;
      return previous;
    });
    f.input.subject.sourceId = f.journal.messaging!.outbox[0]!.message.id;
    await f.kernel.admit(f.input);
    await f.kernel.extendAllowance("run", {
      additionalInvocations: 1,
      additionalExecutionMs: 100,
      reason: "Explicit extension of the selected child",
    });
    expect(f.journal.messaging?.roots[0]).toMatchObject({
      limits: { invocations: 6 },
      usage: { invocations: 3 },
      usedExecutionMs: 250,
      limitExecutionMs: 1100,
    });
    expect(f.journal.runs[0]?.allowanceExtensions?.[0]).toMatchObject({
      rootId: "parent",
      rootBefore: { maxInvocations: 5, executionLimitMs: 1000 },
      rootAfter: { maxInvocations: 6, executionLimitMs: 1100 },
    });
    expect(f.calls).toBe(0);
  });
});
