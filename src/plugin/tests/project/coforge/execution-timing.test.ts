import { describe, expect, it } from "vitest";
import {
  ExecutionKernel,
  type ExecutionKernelHost,
} from "../../../features/coforge/application/execution-kernel";
import {
  emptyExecutionJournal,
  type ExecutionAdmission,
} from "../../../features/coforge/domain/execution-run";
const at = "2026-10-28T12:00:00.000Z";
function fixture(scopeLimit?: number) {
  let journal = emptyExecutionJournal();
  let clock = 0;
  let calls = 0;
  let ids = 0;
  const host: ExecutionKernelHost = {
    journal: {
      load: async () => journal,
      save: async (next) => {
        journal = structuredClone(next);
      },
    },
    now: () => at,
    monotonicMs: () => clock,
    id: () => `attempt-${++ids}`,
    assertEligible: async () => undefined,
    resolveInvocation: () => ({ prompt: "Request", inputArtifactIds: [] }),
    publish: async () => undefined,
    invoke: async (_run, _invocation, _attempt, timing) => {
      await timing?.start();
      calls++;
      clock += 100;
      await timing?.stop();
      return { markdown: "Result", simulated: false };
    },
  };
  const kernel = new ExecutionKernel(host);
  const input: ExecutionAdmission = {
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
    limits: {
      timeoutSeconds: 180,
      maxTurns: 12,
      maxBudgetUsd: 1,
      simulation: false,
      executionLimitMs: 5000,
    },
    checkpoints: [
      {
        id: "human",
        name: "Review",
        kind: "approval",
        instructions: "Review result",
        beforeCursor: 1,
        items: [],
      },
    ],
    invocations: ["one", "two"].map((id) => ({
      id,
      roundId: id,
      agentId: id,
      agentRevision: "r1",
      provider: "claude",
      model: "sonnet",
      instructions: "Analyze",
      access: "none",
      inputRoundIds: [],
      ...(scopeLimit
        ? { executionScope: { id: "council", limitMs: scopeLimit } }
        : {}),
    })),
  };
  return {
    host,
    kernel,
    input,
    advance: (ms: number) => {
      clock += ms;
    },
    get journal() {
      return journal;
    },
    get calls() {
      return calls;
    },
  };
}
describe("accumulated automatic execution allowance", () => {
  it("reports live remaining time between persistence checkpoints so provider startup cannot reuse stale allowance", async () => {
    const f = fixture(100);
    await f.kernel.load();
    await f.kernel.admit(f.input);
    f.host.invoke = async (_run, _invocation, _attempt, timing) => {
      await timing?.start();
      expect(timing?.remainingMs).toBe(100);
      f.advance(50);
      expect(timing?.remainingMs).toBe(50);
      await timing?.checkpoint();
      f.advance(25);
      expect(timing?.remainingMs).toBe(25);
      await timing?.stop();
      return { markdown: "Result", simulated: false };
    };
    f.kernel.resume();
    await f.kernel.step("run");
    expect(f.journal.runs[0]?.timing?.usedMs).toBe(75);
  });
  it("charges asynchronous pre/post processing while excluding the shared provider queue gap", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(f.input);
    f.host.invoke = async (_run, _invocation, _attempt, timing) => {
      await timing?.action?.(async () => {
        f.advance(30);
      });
      f.advance(86400000);
      await timing?.start();
      f.advance(100);
      await timing?.stop();
      await timing?.action?.(async () => {
        f.advance(20);
      }, true);
      return { markdown: "Result", simulated: false };
    };
    f.kernel.resume();
    await f.kernel.step("run");
    expect(f.journal.runs[0]?.timing?.usedMs).toBe(150);
  });
  it("excludes queued, paused, human-checkpoint and unloaded time while persisting actual provider wait", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(f.input);
    f.advance(86400000);
    f.kernel.resume();
    await f.kernel.step("run");
    expect(f.journal.runs[0]?.timing?.usedMs).toBe(100);
    await f.kernel.step("run");
    expect(f.journal.runs[0]?.state).toBe("waiting-human");
    f.advance(86400000);
    f.kernel.pause();
    f.advance(86400000);
    await f.kernel.acknowledgeCheckpoint("run", "human", []);
    f.kernel.dispose();
    await f.kernel.flushTiming();
    f.advance(86400000);
    const reloaded = new ExecutionKernel(f.host);
    await reloaded.load();
    reloaded.resume();
    await reloaded.step("run");
    expect(f.journal.runs[0]?.timing?.usedMs).toBe(200);
    expect(f.calls).toBe(2);
  });
  it("enforces a stricter composed council scope before another member despite a larger workflow allowance", async () => {
    const f = fixture(100);
    await f.kernel.load();
    await f.kernel.admit(f.input);
    f.kernel.resume();
    await f.kernel.step("run");
    await f.kernel.step("run");
    await f.kernel.acknowledgeCheckpoint("run", "human", []);
    await expect(f.kernel.step("run")).rejects.toThrow("execution allowance");
    expect(f.calls).toBe(1);
    expect(f.journal.runs[0]?.timing?.scopes).toEqual([
      { id: "council", usedMs: 100 },
    ]);
  });
  it("checkpoints active wait durably and never charges an unloaded gap after unknown-outcome recovery", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(f.input);
    let ready: () => void = () => undefined;
    let release: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const exit = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.host.invoke = async (_run, _invocation, _attempt, timing) => {
      await timing?.start();
      f.advance(100);
      await timing?.checkpoint();
      ready();
      await exit;
      await timing?.stop();
      return { markdown: "Result", simulated: false };
    };
    f.kernel.resume();
    const active = f.kernel.step("run");
    await entered;
    const checkpoint = structuredClone(f.journal);
    expect(checkpoint.runs[0]?.timing?.usedMs).toBe(1100);
    // A crash preserves one bounded active reservation. Recovery cannot infer or charge the unloaded interval.
    f.advance(86400000);
    const recovered = new ExecutionKernel({
      ...f.host,
      journal: {
        load: async () => checkpoint,
        save: async (next) => {
          Object.assign(checkpoint, structuredClone(next));
        },
      },
    });
    await recovered.load();
    expect(checkpoint.runs[0]?.timing?.usedMs).toBe(1100);
    expect(checkpoint.runs[0]?.timing?.active).toBeUndefined();
    expect(checkpoint.runs[0]?.state).toBe("attention");
    release();
    await active;
  });
  it("separates explicit message expiry from accepted execution time and enforces the root aggregate", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(f.input);
    await f.kernel.updateMessaging(() => ({
      roots: [
        {
          id: "run",
          projectId: "project",
          teamId: "team",
          deadline: "2000-01-01T00:00:00.000Z",
          stopped: false,
          limits: { depth: 3, descendants: 10, messages: 10, invocations: 10 },
          usage: { descendants: 0, messages: 0, invocations: 2 },
          usedExecutionMs: 0,
          limitExecutionMs: 100,
        },
      ],
      outbox: [],
    }));
    f.kernel.resume();
    await f.kernel.step("run");
    expect(f.calls).toBe(1);
    expect(f.journal.messaging?.roots[0]?.usedExecutionMs).toBe(100);
    await f.kernel.step("run");
    await f.kernel.acknowledgeCheckpoint("run", "human", []);
    await expect(f.kernel.step("run")).rejects.toThrow("execution allowance");
    expect(f.calls).toBe(1);
  });
});
