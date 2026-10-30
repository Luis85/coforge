import { expect, it, vi } from "vitest";
import { ObsMusicPreparation } from "../../../features/coforge/application/obs-music-preparation";
import { scheduledStream } from "../../../features/coforge/domain/schedule";
import { obsSceneAction } from "../../../features/coforge/domain/obs-scenes-check";
import type { ObsSceneDetail } from "../../../features/coforge/domain/obs-scenes";
import { scheduleDraft } from "../../../presentation/stores/coforge-schedule";

function kit(failAt = 0) {
  let mutations = 0;
  const broadcast = {
    epoch: 1,
    revision: 1,
    scenes: [
      { id: "live", name: "Live" },
      { id: "brb", name: "BRB" },
    ],
    programSceneId: "live",
    active: false,
    reconnecting: false,
    transitioning: false,
    timecode: "",
    observedAt: new Date().toISOString(),
  };
  const context = { epoch: 1, collection: 0, revision: 0 };
  const inputs = [
    { id: "music", kind: "ffmpeg_source" },
    { id: "break-music", kind: "vlc_source" },
  ];
  const details: Record<string, ObsSceneDetail> = Object.fromEntries(
    broadcast.scenes.map((scene) => [
      scene.id,
      {
        context,
        sceneId: scene.id,
        name: scene.name,
        items: [],
        sources: inputs.map((input) => ({
          id: `input:${input.id}`,
          name: input.id,
          kind: "input" as const,
        })),
        available: ["item-add"],
        observedAt: broadcast.observedAt,
      },
    ]),
  );
  const execute = vi.fn(async (input: unknown) => {
    if (++mutations === failAt) throw new Error("OBS unavailable");
    const action = obsSceneAction(input);
    if (action.kind !== "item-add") throw new Error("Unexpected action");
    const detail = details[action.sceneId]!;
    detail.items.push({
      id: detail.items.length + 1,
      sourceId: action.sourceId,
      name: action.sourceId,
      kind: "input",
      enabled: action.enabled ?? true,
      locked: false,
      index: 0,
    });
    return { snapshot: broadcast, detail };
  });
  const inspect = vi.fn(async () => ({ broadcast, context, inputs }));
  const preparation = new ObsMusicPreparation(
    { inspect },
    { inspect: async (id) => details[id]!, execute },
  );
  const plan = scheduledStream({
    ...scheduleDraft(),
    startsAt: new Date().toISOString(),
    name: "Music show",
    liveSceneId: "live",
    breakSceneId: "brb",
    music: { liveInputId: "music", breakInputId: "break-music" },
  });
  return { preparation, plan, broadcast, inputs, details, execute, inspect };
}
it("saves optional music assignments and adds existing OBS media to each scene disabled, without playback or duplicate memberships", async () => {
  const app = kit();
  expect(app.execute).not.toHaveBeenCalled();
  expect(app.plan.music).toEqual({
    liveInputId: "music",
    breakInputId: "break-music",
  });
  await app.preparation.prepare(app.plan);
  expect(app.execute.mock.calls.map(([action]) => action)).toEqual([
    {
      kind: "item-add",
      sceneId: "live",
      sourceId: "input:music",
      enabled: false,
      expected: { epoch: 1, collection: 0, revision: 0 },
    },
    {
      kind: "item-add",
      sceneId: "brb",
      sourceId: "input:break-music",
      enabled: false,
      expected: { epoch: 1, collection: 0, revision: 0 },
    },
  ]);
  await app.preparation.prepare(app.plan);
  expect(app.execute).toHaveBeenCalledTimes(2);
  expect(app.details.live?.items[0]?.enabled).toBe(false);
});
it("validates both assignments before effects and rejects missing or non-media sources and active OBS", async () => {
  const app = kit();
  app.inputs[1]!.kind = "browser_source";
  await expect(app.preparation.prepare(app.plan)).rejects.toThrow(
    /media source/,
  );
  expect(app.execute).not.toHaveBeenCalled();
  app.inputs[1]!.kind = "vlc_source";
  app.broadcast.active = true;
  await expect(app.preparation.prepare(app.plan)).rejects.toThrow(/stop/);
  expect(app.execute).not.toHaveBeenCalled();
  app.broadcast.active = false;
  await expect(
    app.preparation.prepare({
      ...app.plan,
      music: { liveInputId: "missing", breakInputId: "" },
    }),
  ).rejects.toThrow(/media source/);
  expect(app.execute).not.toHaveBeenCalled();
});
it("retains confirmed scene additions after a later failure and rejects changed OBS identity before another addition", async () => {
  const app = kit(2);
  await expect(app.preparation.prepare(app.plan)).rejects.toThrow(
    "OBS unavailable",
  );
  expect(app.execute).toHaveBeenCalledTimes(2);
  expect(app.details.live?.items).toHaveLength(1);
  await app.preparation.prepare(app.plan);
  expect(app.execute).toHaveBeenCalledTimes(3);
  expect(app.details.live?.items).toHaveLength(1);
  expect(app.details.brb?.items).toHaveLength(1);
  const fresh = kit();
  fresh.inspect.mockImplementationOnce(async () => ({
    broadcast: fresh.broadcast,
    context: { epoch: 1, collection: 0, revision: 0 },
    inputs: fresh.inputs,
  }));
  fresh.inspect.mockImplementation(async () => ({
    broadcast: fresh.broadcast,
    context: { epoch: 2, collection: 0, revision: 0 },
    inputs: fresh.inputs,
  }));
  await expect(fresh.preparation.prepare(fresh.plan)).rejects.toThrow(
    /changed/,
  );
  expect(fresh.execute).not.toHaveBeenCalled();
});
