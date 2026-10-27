import type { ObsSnapshot } from "../../features/coforge/domain/obs";
import type { ObsMetrics } from "../../features/coforge/domain/stream-metrics";
import type { ObsClient } from "./obs-client";
/** Read health independently of UI. Unavailable stats never become zero or a successful stream mutation. */
export async function readObsMetrics(
  client: ObsClient,
  snapshot: () => Promise<ObsSnapshot>,
  closed: () => boolean,
): Promise<ObsMetrics> {
  const unavailable: ObsMetrics = {
    state: "unavailable",
    startedAt: null,
    scene: null,
    health: {},
  };
  if (closed() || !client.connected) return unavailable;
  try {
    const value = await snapshot();
    const health = { ...value.health };
    const stats = await client.request("GetStats").catch(() => ({}));
    for (const key of [
      "cpuUsage",
      "memoryUsage",
      "availableDiskSpace",
      "activeFps",
      "averageFrameRenderTime",
      "renderSkippedFrames",
      "renderTotalFrames",
      "outputSkippedFrames",
      "outputTotalFrames",
    ]) {
      const amount = Reflect.get(stats, key);
      health["stats_" + key] =
        typeof amount === "number" && Number.isFinite(amount) && amount >= 0
          ? amount
          : null;
    }
    if (closed() || !client.connected || value.epoch !== client.epoch)
      return unavailable;
    const duration = value.health?.outputDuration;
    return {
      state: value.active ? "live" : "offline",
      epoch: value.epoch,
      observedAt: value.observedAt,
      startedAt:
        value.active && typeof duration === "number"
          ? new Date(Date.parse(value.observedAt) - duration).toISOString()
          : null,
      scene:
        value.scenes.find((scene) => scene.id === value.programSceneId)?.name ??
        null,
      health,
    };
  } catch {
    return unavailable;
  }
}
