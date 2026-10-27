import { describe, expect, it, vi } from "vitest";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import { recordOperation } from "../../../features/coforge/application/population";
import { operationsLog } from "../../../infrastructure/coforge/operations-log";
import { StructuredLogger } from "../../../application/logging";
import type { OperationRecord } from "../../../features/coforge/domain/population";
import { OPERATION_CODES } from '../../../features/coforge/domain/population';
import { MemoryStorage } from "./memory-storage";

describe("operational evidence", () => {
  it('admits every declared operation and scene action through bounded safe catalogs', () => {
    const logger = new StructuredLogger({ report: () => undefined }, () => new Date().toISOString(), { capacity: 1000 });
    logger.setLevel('debug'); const log = operationsLog(logger);
    for (const code of OPERATION_CODES) log.record({ sequence: 1, at: new Date().toISOString(), code, count: 1, effect: 'committed', ...(code === 'obs-scene-action-confirmed' ? { action: 'scene-create' as const } : {}) });
    expect(log.snapshot()).toHaveLength(OPERATION_CODES.length); expect(logger.statistics.rejected).toBe(0);
    expect(log.snapshot().find(record => record.code === 'coforge.obs-scene-action-confirmed')?.operation).toBe('coforge.scene.scene-create');
    logger.dispose();
  });
  it("publishes only after a successful commit and bounds records without losing counters", async () => {
    const storage = new MemoryStorage();
    const observed: OperationRecord[] = [];
    const store = new StudioStore(storage, {
      publish: (event) => {
        observed.push(event.record);
      },
    });
    await store.init();
    storage.failNextSave = true;
    await expect(store.transaction((state) => recordOperation(state, "registered"))).rejects.toThrow("Disk full");
    expect(observed).toHaveLength(0);
    await store.transaction((state) => {
      for (let count = 0; count < 1005; count++) recordOperation(state, "registered");
    });
    expect(store.snapshot().population).toMatchObject({
      counters: { registered: 1005 },
      droppedOperations: 5,
      nextSequence: 1006,
    });
    expect(store.snapshot().population?.operations).toHaveLength(1000);
    expect(observed).toHaveLength(1005);
  });
  it("exports catalogued diagnostic codes and aggregate metadata without player identities", () => {
    const logger = new StructuredLogger({ report: () => undefined }, () => new Date().toISOString());
    const log = operationsLog(logger);
    log.record({
      sequence: 1,
      at: new Date().toISOString(),
      code: "moderation-uncertain",
      effect: "uncertain",
      count: 1,
      playerId: "twitch:PRIVATE_ID",
    });
    expect(log.snapshot()).toMatchObject([
      {
        code: "coforge.moderation-uncertain",
        operation: "coforge.moderation",
        metadata: { count: 1, effect: "uncertain" },
      },
    ]);
    expect(JSON.stringify(log.snapshot())).not.toContain("PRIVATE_ID");
    logger.dispose();
  });
  it("isolates event subscriber failures and publishes immutable facts after the write", async () => {
    const storage = new MemoryStorage();
    const failed = vi.fn();
    const store = new StudioStore(storage, undefined, failed);
    await store.init();
    const events: string[] = [];
    store.subscribeEvents(() => {
      throw new Error("Private observer failure");
    });
    store.subscribeEvents(async () => {
      throw new Error("Private async failure");
    });
    const off = store.subscribeEvents((event) => {
      expect(storage.saves).toBeGreaterThan(0);
      expect(Object.isFrozen(event.record)).toBe(true);
      events.push(event.type);
    });
    await store.transaction((state) => recordOperation(state, "registered"));
    await Promise.resolve();
    expect(events).toEqual(["registered"]);
    expect(failed).toHaveBeenCalledTimes(2);
    expect(store.snapshot().population?.counters.registered).toBe(1);
    off();
    store.disposeObservers();
    await store.transaction((state) => recordOperation(state, "registered"));
    expect(events).toHaveLength(1);
  });
});
