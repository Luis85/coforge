import { describe, expect, it } from "vitest";
import {
  costSummary,
  normalizedUsd,
  taskCost,
  usdNanos,
  type AICostTask,
} from "../../../features/coforge/domain/ai-costs";
import { AICostService } from "../../../features/coforge/application/ai-cost-service";
import { emptyStore, nodeTimers } from "./memory-storage";
const task = (
  id: string,
  provider: AICostTask["provider"] = "claude",
): AICostTask => ({
  id,
  provider,
  featureId: "CF-101",
  featureTitle: "Feature",
  projectId: "CFP-001",
  projectName: "Game",
  stage: "screen",
  status: "failed",
  startedAt: "2026-10-27T10:00:00Z",
});
describe("per-task AI usage costs", () => {
  it("sums decimal USD exactly and keeps missing, pending, manual and simulation costs distinct", () => {
    const summary = costSummary([
      { ...task("one"), reportedUsd: 0.1 },
      { ...task("two"), reportedUsd: 0.2 },
      { ...task("three", "herdr"), manualUsd: "0.4" },
      task("missing"),
      { ...task("pending"), status: "running" },
      { ...task("demo", "demo"), reportedUsd: 999 },
    ]);
    expect(summary).toEqual({
      nanos: 700000000n,
      reported: 2,
      manual: 1,
      missing: 1,
      pending: 1,
      simulations: 1,
    });
    expect(taskCost({ ...task("zero"), reportedUsd: 0 })).toEqual({
      source: "reported",
      nanos: 0n,
    });
    expect(normalizedUsd("1,250000000")).toBe("1.25");
    expect(usdNanos("0.000000001")).toBe(1n);
    expect(() => usdNanos("0.0000000001")).toThrow();
  });
  it("retains historical tasks and manual fallback while giving a later provider report priority", async () => {
    const { store } = await emptyStore();
    let source = [task("one")];
    let saved: AICostTask[] = [];
    const service = new AICostService(
      store,
      {
        load: async () => structuredClone(saved),
        save: async (tasks) => {
          saved = structuredClone(tasks);
        },
      },
      () => source,
      nodeTimers(),
    );
    await service.start();
    const before = service.snapshot().tasks[0]!;
    await service.setManual(
      "one",
      "0.5",
      "Recorded from the agent session",
      JSON.stringify(before),
    );
    expect(taskCost(service.snapshot().tasks[0]!).source).toBe("manual");
    source = [{ ...task("one"), reportedUsd: 0.25 }];
    await service.refresh();
    expect(taskCost(service.snapshot().tasks[0]!)).toEqual({
      source: "reported",
      nanos: 250000000n,
    });
    expect(service.snapshot().tasks[0]?.manualUsd).toBe("0.5");
    source = [];
    await service.refresh();
    expect(service.snapshot().tasks).toHaveLength(1);
    await expect(
      service.setManual("one", "1", "", JSON.stringify(before)),
    ).rejects.toThrow("changed");
    await service.dispose();
  });
  it("archives usage through partial cumulative refreshes and operational pruning without counting an attempt twice", async () => {
    const { store } = await emptyStore();
    let source: AICostTask[] = [
      {
        ...task("tokens"),
        usage: { inputTokens: 10 },
        usageSource: "provider",
      },
    ];
    let saved: AICostTask[] = [];
    const storage = {
      load: async () => structuredClone(saved),
      save: async (tasks: AICostTask[]) => {
        saved = structuredClone(tasks);
      },
    };
    const service = new AICostService(
      store,
      storage,
      () => source,
      nodeTimers(),
    );
    await service.start();
    source = [
      {
        ...task("tokens"),
        usage: { outputTokens: 4 },
        usageSource: "provider",
      },
    ];
    await service.refresh();
    expect(service.snapshot().tasks[0]?.usage).toEqual({
      inputTokens: 10,
      outputTokens: 4,
    });
    source = [
      {
        ...task("tokens"),
        usage: { inputTokens: 15, outputTokens: 6 },
        usageSource: "provider",
      },
    ];
    await service.refresh();
    await service.refresh();
    expect(service.snapshot().tasks).toHaveLength(1);
    expect(service.snapshot().tasks[0]?.usage).toEqual({
      inputTokens: 15,
      outputTokens: 6,
    });
    source = [];
    await service.refresh();
    await service.dispose();
    const reopened = new AICostService(store, storage, () => [], nodeTimers());
    await reopened.start();
    expect(reopened.snapshot().tasks[0]?.usage).toEqual({
      inputTokens: 15,
      outputTokens: 6,
    });
    await reopened.dispose();
  });
});
