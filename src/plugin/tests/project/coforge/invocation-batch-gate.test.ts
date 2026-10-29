import { expect, it } from "vitest";
import {
  InvocationGate,
  type InvocationLane,
} from "../../../features/coforge/application/invocation-gate";
import { deferred } from "./execution-fanout-fixture";

it("allows real overlap only within one exclusive batch while legacy and later batches wait", async () => {
  const gate = new InvocationGate();
  const entered: string[] = [];
  const hold = deferred<void>();
  const ready = deferred<void>();
  const first = gate.runBatch(async (lane) => {
    await Promise.all(
      ["a", "b"].map((id) =>
        lane.run(async () => {
          entered.push(id);
          if (entered.length === 2) ready.resolve();
          await hold.promise;
        }),
      ),
    );
  });
  await ready.promise;
  const legacy = gate.run(async () => {
    entered.push("legacy");
  });
  const next = gate.runBatch(async (lane) => {
    await lane.run(async () => {
      entered.push("next");
    });
  });
  expect(entered).toEqual(["a", "b"]);
  hold.resolve();
  await Promise.all([first, legacy, next]);
  expect(entered).toEqual(["a", "b", "legacy", "next"]);
});

it("drains every started member before releasing a failed batch and invalidates its scoped lane", async () => {
  const gate = new InvocationGate();
  const hold = deferred<void>();
  const ready = deferred<void>();
  let scoped: InvocationLane | undefined;
  let legacyEntered = false;
  const batch = gate.runBatch(async (lane) => {
    scoped = lane;
    void lane.run(async () => {
      ready.resolve();
      await hold.promise;
    });
    throw new Error("batch failed");
  });
  const failure = expect(batch).rejects.toThrow("batch failed");
  await ready.promise;
  const legacy = gate.run(async () => {
    legacyEntered = true;
  });
  await Promise.resolve();
  expect(legacyEntered).toBe(false);
  hold.resolve();
  await failure;
  await legacy;
  if (!scoped) throw new Error("Scoped lane was not created.");
  await expect(scoped.run(async () => {})).rejects.toThrow("closed");
});
