import type { StudioStore } from "../../src/plugin/features/coforge/application/studio-store";
import type { StudioExample } from "../../src/plugin/features/coforge/application/studio-example";
import { ObsSceneWorkflow } from "../../src/plugin/features/coforge/application/obs-scene-workflow";
import { IntegrationFailure } from "../../src/plugin/features/coforge/domain/integration-failure";
import { ObsScenesAdapter } from "../../src/plugin/infrastructure/coforge/obs-scenes-adapter";
import {
  ObsSceneServer,
  OBS_SCENE_SERVER_REQUESTS,
} from "../../src/plugin/tests/support/coforge/obs-scene-server";
/** Explicit, isolated browser example. Every RPC is in-memory and cannot control an OBS instance. */
export function createLiveStudioPreview(store: StudioStore): StudioExample {
  const server = new ObsSceneServer();
  let busy = false;
  let uncertain = false;
  const adapter = new ObsScenesAdapter(
    server,
    server.snapshot,
    () => OBS_SCENE_SERVER_REQUESTS,
    server.context,
  );
  const scenes = new ObsSceneWorkflow(store, adapter, {
    claim: async () => {
      if (busy)
        throw new IntegrationFailure(
          "validation",
          "Example scene action in progress",
        );
      busy = true;
    },
    release: async () => {
      busy = false;
    },
    fresh: server.snapshot,
    accept: async () => undefined,
    uncertain: () => uncertain,
    invalidate: () => undefined,
    failed: (_message, unknown) => {
      uncertain = unknown;
    },
  });
  return {
    scenes,
    snapshot: server.readSnapshot,
    uncertain: () => uncertain,
    refresh: async () => {
      uncertain = false;
      await store.transaction((state) => {
        if (state.obsCommand) state.obsCommand.status = "reconciled";
      });
    },
    telemetry: () => {
      const checkedAt = new Date().toISOString();
      return {
        channelId: "example-channel",
        viewers: {
          checkedAt,
          value: {
            state: "live",
            viewers: 54,
            streamId: "example",
            startedAt: checkedAt,
          },
        },
        obs: {
          checkedAt,
          value: {
            epoch: 1,
            state: "live",
            observedAt: checkedAt,
            startedAt: checkedAt,
            scene:
              server.scenes.find((scene) => scene.id === server.programId)
                ?.name ?? null,
            health: {
              bitrateKbps: 6000,
              outputDroppedFramePercent: 0.1,
              stats_activeFps: 60,
              stats_cpuUsage: 18.4,
              outputCongestion: 0.02,
            },
          },
        },
        chat: { messages: 18, commands: 4, observedSeconds: 60, checkedAt },
      };
    },
  };
}
