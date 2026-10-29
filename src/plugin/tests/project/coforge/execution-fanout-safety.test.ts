import { expect, it, vi } from "vitest";
import { ExecutionKernel } from "../../../features/coforge/application/execution-kernel";
import { answer, fanoutFixture } from "./execution-fanout-fixture";
import type { ExecutionTimingHooks } from "../../../features/coforge/application/execution-timing";

it("reserves finite aggregate time for every member before contacting any provider", async () => {
  const f = fanoutFixture();
  f.admission.limits!.executionLimitMs = 1000;
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  await expect(f.kernel.step("run")).rejects.toThrow();
  expect(f.entered).toEqual([]);
  expect(f.journal.runs[0]?.attempts.map((a) => a.status)).toEqual([
    "not-started",
    "not-started",
  ]);
  expect(f.journal.runs[0]?.reason).toContain("No provider was contacted");
  await expect(
    f.kernel.recordTelemetry(
      "run",
      f.journal.runs[0]!.attempts[0]!.id,
      undefined,
      0.5,
    ),
  ).rejects.toThrow("not contacted");
  expect(f.journal.runs[0]?.timing?.parallel).toBeUndefined();
});

it("validates every member and whole-batch UTF-8 evidence capacity before any provider", async () => {
  const f = fanoutFixture();
  f.admission.subject.markdown = "界".repeat(160000);
  f.admission.context = "界".repeat(160000);
  f.admission.definitionSnapshot = "界".repeat(150000);
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  await expect(f.kernel.step("run")).rejects.toThrow();
  expect(f.entered).toEqual([]);
  expect(f.journal.runs[0]?.attempts).toEqual([]);
  expect(f.journal.runs[0]?.reason).toContain("No provider was contacted");
});

it("pauses before the next round and refuses recovery changes while peer providers are active", async () => {
  const f = fanoutFixture();
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  await expect(f.kernel.retry("run", true)).rejects.toThrow("active");
  await expect(f.kernel.skipInvocation("run", "Skip", true)).rejects.toThrow(
    "active",
  );
  await expect(f.kernel.repair("run")).rejects.toThrow("active");
  f.kernel.pause();
  f.waits.get("a")!.resolve(answer("A"));
  f.waits.get("b")!.resolve(answer("B"));
  await running;
  await expect(f.kernel.step("run")).rejects.toThrow("paused");
  expect(f.entered).toEqual(["a", "b"]);
});

it("repairs all retained peer results in declared order without invoking either member again", async () => {
  const f = fanoutFixture();
  let locked = true;
  f.host.publish = async (_run, artifact) => {
    if (locked) throw new Error("note locked");
    f.published.push(artifact.invocationId);
  };
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  f.waits.get("a")!.resolve(answer("A"));
  f.waits.get("b")!.resolve(answer("B"));
  await expect(running).rejects.toThrow("note locked");
  expect(f.journal.runs[0]?.artifacts).toHaveLength(2);
  expect(f.journal.runs[0]?.cursor).toBe(0);
  locked = false;
  await f.kernel.repair("run");
  expect(f.published).toEqual(["a", "b"]);
  expect(f.entered).toEqual(["a", "b"]);
});

it("charges overlapping agents as aggregate active time and retains separate per-attempt costs", async () => {
  const f = fanoutFixture();
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  f.advance(100);
  f.waits.get("a")!.resolve(answer("A"));
  await vi.waitFor(() => expect(f.journal.runs[0]?.artifacts).toHaveLength(1));
  f.advance(50);
  f.waits.get("b")!.resolve(answer("B"));
  await running;
  expect(f.journal.runs[0]?.timing?.usedMs).toBe(250);
  expect(f.journal.runs[0]?.attempts.map((a) => a.costUsd)).toEqual([0.1, 0.1]);
});

it("keeps telemetry and every started intent when result persistence fails, then requires explicit recovery", async () => {
  const f = fanoutFixture();
  const invoke = f.host.invoke;
  f.host.invoke = async (...args) => {
    await f.kernel.recordTelemetry(
      args[0].id,
      args[2].id,
      { inputTokens: 10 },
      0.2,
    );
    return invoke(...args);
  };
  const save = f.host.journal.save;
  f.host.journal.save = async (next, previous) => {
    if (next.runs[0]?.artifacts.length) throw new Error("disk unavailable");
    await save(next, previous);
  };
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  f.waits.get("a")!.resolve(answer("A"));
  f.waits.get("b")!.resolve(answer("B"));
  await expect(running).rejects.toThrow("disk unavailable");
  const recovered = new ExecutionKernel(f.host);
  await recovered.load();
  recovered.resume();
  expect(f.journal.runs[0]?.attempts.map((a) => a.status)).toEqual([
    "unknown",
    "unknown",
  ]);
  expect(f.journal.runs[0]?.attempts.map((a) => a.costUsd)).toEqual([0.2, 0.2]);
  await expect(recovered.step("run")).rejects.toThrow("attention");
  expect(f.entered).toHaveLength(2);
});

it("does not double-charge a peer during the committed checkpoint or stop notification", async () => {
  const f = fanoutFixture();
  f.admission.limits!.executionLimitMs = 5000;
  const invoke = f.host.invoke;
  const hooks = new Map<string, ExecutionTimingHooks>();
  f.host.invoke = async (...args) => {
    if (args[3]) hooks.set(args[1].id, args[3]);
    return invoke(...args);
  };
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  let checkpointRemaining: number | undefined;
  f.kernel.subscribe((journal) => {
    if (
      journal.runs[0]?.timing?.parallel?.some(
        (item) => item.accountedMs === 1500,
      )
    )
      checkpointRemaining = hooks.get("b")?.remainingMs;
  });
  f.advance(1500);
  await hooks.get("a")!.checkpoint();
  // A's new 1s escrow remains held, while its already-accounted first 1.5s cannot be charged again.
  expect(checkpointRemaining).toBe(1000);
  let stoppedRemaining: number | undefined;
  f.kernel.subscribe((journal) => {
    if (journal.runs[0]?.timing?.parallel?.length === 1)
      stoppedRemaining = hooks.get("b")?.remainingMs;
  });
  f.waits.get("a")!.resolve(answer("A"));
  await vi.waitFor(() => expect(f.journal.runs[0]?.artifacts).toHaveLength(1));
  expect(stoppedRemaining).toBe(2000);
  f.waits.get("b")!.resolve(answer("B"));
  await running;
  expect(f.journal.runs[0]?.timing?.usedMs).toBe(3000);
});
