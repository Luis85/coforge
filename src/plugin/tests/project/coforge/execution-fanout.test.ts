import { expect, it, vi } from "vitest";
import { ExecutionKernel } from "../../../features/coforge/application/execution-kernel";
import { answer, fanoutFixture } from "./execution-fanout-fixture";

it("starts every fan-out member together after durable intents and seals the round in declared order", async () => {
  const f = fanoutFixture();
  const invoke = f.host.invoke;
  f.host.invoke = async (...args) => {
    if (args[1].roundId === "opinions") {
      expect(f.journal.runs[0]?.attempts).toHaveLength(2);
      expect(args[2].dispatch.inputArtifactIds).toEqual([]);
    } else
      expect(args[2].dispatch.inputArtifactIds).toEqual(
        f.journal.runs[0]?.artifacts.map((a) => a.id),
      );
    return invoke(...args);
  };
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toEqual(["a", "b"]));
  f.waits.get("b")!.resolve(answer("Opinion B"));
  await vi.waitFor(() => expect(f.journal.runs[0]?.artifacts).toHaveLength(1));
  expect(f.published).toEqual([]);
  expect(f.entered).not.toContain("c");
  f.waits.get("a")!.resolve(answer("Opinion A"));
  await running;
  expect(f.published).toEqual(["a", "b"]);
  expect(f.journal.runs[0]?.cursor).toBe(2);
  const next = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toContain("c"));
  f.waits.get("c")!.resolve(answer("Solution"));
  await next;
  expect(f.journal.runs[0]?.state).toBe("completed");
});

it("retains a successful peer and retries only the uncertain member after explicit acknowledgement", async () => {
  const f = fanoutFixture();
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  f.waits.get("b")!.resolve(answer("Saved B"));
  f.waits.get("a")!.reject(new Error("External outcome uncertain"));
  await expect(running).rejects.toThrow();
  expect(
    f.journal.runs[0]?.attempts.find((a) => a.invocationId === "b")?.status,
  ).toBe("responded");
  await expect(f.kernel.retry("run")).rejects.toThrow("acknowledge");
  await f.kernel.retry("run", true);
  f.host.invoke = async (_run, invocation) => {
    f.entered.push(invocation.id);
    return answer("Retried A");
  };
  await f.kernel.step("run");
  expect(f.entered).toEqual(["a", "b", "a"]);
  expect(f.published).toEqual(["a", "b"]);
  expect(f.journal.runs[0]?.attempts).toHaveLength(3);
});

it("preserves every in-flight fan-out intent as unknown on reload without replay", async () => {
  const f = fanoutFixture();
  await f.kernel.load();
  await f.kernel.admit(f.admission);
  f.kernel.resume();
  const running = f.kernel.step("run");
  await vi.waitFor(() => expect(f.entered).toHaveLength(2));
  const captured = structuredClone(f.journal);
  const recovered = new ExecutionKernel({
    ...f.host,
    journal: {
      load: async () => captured,
      save: async (next) => {
        Object.assign(captured, structuredClone(next));
      },
    },
  });
  await recovered.load();
  recovered.resume();
  expect(captured.runs[0]?.attempts.map((a) => a.status)).toEqual([
    "unknown",
    "unknown",
  ]);
  await expect(recovered.step("run")).rejects.toThrow("attention");
  expect(f.entered).toHaveLength(2);
  f.waits.get("a")!.resolve(answer("A"));
  f.waits.get("b")!.resolve(answer("B"));
  await running;
});
