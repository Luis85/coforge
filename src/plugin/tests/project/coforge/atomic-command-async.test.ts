import { expect, it } from "vitest";
import { emptyStore } from "./memory-storage";

it("keeps async command preparation inside the same FIFO without publishing or exposing partial effects", async () => {
  const { store, storage } = await emptyStore();
  let release: (() => void) | undefined;
  const ticket = new Promise<void>((resolve) => {
    release = resolve;
  });
  const order: string[] = [];
  const saves = storage.saves;
  const first = store.transaction(
    async (state) => {
      state.ingestMeta.processedMessages.push({ id: "first-command" });
      order.push("reserving");
      await ticket;
      order.push("reserved");
      return "first";
    },
    { atomicCommand: true },
  );
  const second = store.transaction((state) => {
    order.push("second");
    expect(state.ingestMeta.processedMessages).toContainEqual({
      id: "first-command",
    });
  });
  await Promise.resolve();
  expect(order).toEqual(["reserving"]);
  expect(storage.saves).toBe(saves);
  expect(store.internalSnapshot().ingestMeta.processedMessages).toHaveLength(0);
  release?.();
  expect(await first).toBe("first");
  await second;
  expect(order).toEqual(["reserving", "reserved", "second"]);
});

it("does not commit an async reservation failure and permits the next queued command to read the unchanged state", async () => {
  const { store, storage } = await emptyStore();
  const saves = storage.saves;
  await expect(
    store.transaction(
      async (state) => {
        state.ingestMeta.processedMessages.push({ id: "not-durable" });
        await Promise.resolve();
        throw new Error("Reservation unavailable");
      },
      { atomicCommand: true },
    ),
  ).rejects.toThrow("Reservation unavailable");
  expect(storage.saves).toBe(saves);
  await store.transaction((state) => {
    expect(state.ingestMeta.processedMessages).toHaveLength(0);
  });
});
