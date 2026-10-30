import { expect, it, vi } from "vitest";
import { StreamPlanPreparation } from "../../../features/coforge/application/schedule-preparation";
import { emptyObsState } from "../../../features/coforge/domain/obs";
import { emptyStore } from "./memory-storage";
import {
  scheduledStream,
  scheduleBody,
} from "../../../features/coforge/domain/schedule";
it("validates an explicit plan without scheduling any live side effects", () => {
  const plan = scheduledStream({
    id: "CFS-abc",
    name: "Build night",
    startsAt: "2026-11-01T19:00:00.000Z",
    timezone: "Europe/Berlin",
    projectId: "CFP-001",
    title: "Building together",
    categoryId: "123",
    categoryName: "Game",
    tags: ["English"],
    language: "en",
    liveSceneId: "live",
    breakSceneId: "brb",
    status: "planned",
  });
  expect(plan.startsAt).toBe("2026-11-01T19:00:00.000Z");
  expect(scheduleBody(plan)).toContain("## Storyboard");
  expect(() => scheduledStream({ ...plan, startsAt: "tomorrow" })).toThrow();
  expect(() => scheduledStream({ ...plan, timezone: "Not/AZone" })).toThrow();
});
it("prepares only the explicitly requested capability and rejects scene configuration while on air", async () => {
  const { store } = await emptyStore();
  const selectProject = vi.fn(async () => {});
  const updateChannel = vi.fn(async () => {});
  const configure = vi.fn(async () => {});
  const preparation = new StreamPlanPreparation(
    { store, state: () => store.snapshot(), selectProject },
    { updateChannel },
    { configure },
    { prepare: vi.fn(async () => {}) },
  );
  const plan = scheduledStream({
    id: "CFS-test",
    name: "Show",
    startsAt: new Date().toISOString(),
    timezone: "UTC",
    projectId: "CFP-001",
    title: "Build night",
    categoryId: "123",
    categoryName: "Game",
    tags: ["English"],
    language: "en",
    liveSceneId: "live",
    breakSceneId: "brb",
    status: "planned",
  });
  expect(updateChannel).not.toHaveBeenCalled();
  expect(configure).not.toHaveBeenCalled();
  await preparation.project(plan);
  expect(selectProject).toHaveBeenCalledWith("CFP-001");
  await expect(preparation.channel({ ...plan, title: "" })).rejects.toThrow(
    "Set a title",
  );
  expect(updateChannel).not.toHaveBeenCalled();
  await preparation.channel(plan);
  expect(updateChannel).toHaveBeenCalledWith({
    title: "Build night",
    categoryId: "123",
    tags: ["English"],
    language: "en",
  });
  const snapshot = {
    epoch: 1,
    revision: 1,
    scenes: [
      { id: "live", name: "Live" },
      { id: "brb", name: "BRB" },
    ],
    programSceneId: "live",
    active: true,
    reconnecting: false,
    transitioning: false,
    timecode: "00:01:00",
    observedAt: new Date().toISOString(),
  };
  await store.updateRuntime({
    obs: { ...emptyObsState(), connection: "connected", snapshot },
  });
  await expect(preparation.scenes(plan)).rejects.toThrow("stop the stream");
  expect(configure).not.toHaveBeenCalled();
  await store.updateRuntime({
    obs: {
      ...emptyObsState(),
      connection: "connected",
      snapshot: { ...snapshot, active: false },
    },
  });
  await preparation.scenes(plan);
  expect(configure).toHaveBeenCalledWith(
    expect.objectContaining({ liveSceneId: "live", breakSceneId: "brb" }),
  );
});
