import { describe, expect, it } from "vitest";
import { streamSetupProgress } from "../../../features/coforge/domain/stream-setup";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { MemoryStorage, nodeTimers } from "./memory-storage";
import { defaultIntegration } from "../../../features/coforge/domain/seed";
import { defaultObsSettings, emptyObsState } from "../../../features/coforge/domain/obs";
import { disconnectedTwitch } from "../../../features/coforge/domain/twitch";

const input = () => ({
  obs: emptyObsState(),
  settings: defaultObsSettings(),
  twitch: disconnectedTwitch(),
  integration: defaultIntegration(),
  outputReviewed: false,
});
describe("guided stream setup", () => {
  it("does not mistake saved configuration for verified readiness", () => {
    const value = input();
    value.settings.liveSceneId = "live";
    value.integration.twitchClientId = "fixture-client";
    const progress = streamSetupProgress(value);
    expect(progress.ready).toBe(false);
    expect(progress.steps.filter((step) => step.ready)).toHaveLength(0);
  });
  it("requires current OBS scenes, Twitch permissions and human output review", () => {
    const value = input();
    value.obs = {
      ...emptyObsState(),
      connection: "connected",
      snapshot: {
        epoch: 1,
        revision: 1,
        scenes: [{ id: "live", name: "Gameplay" }],
        programSceneId: "live",
        active: false,
        reconnecting: false,
        transitioning: false,
        timecode: "",
        observedAt: new Date().toISOString(),
      },
    };
    value.settings.liveSceneId = "live";
    value.integration.twitchEnabled = true;
    value.integration.twitchBroadcasterId = "channel";
    value.twitch = {
      ...disconnectedTwitch(),
      phase: "connected",
      streamer: { id: "channel", login: "streamer", scopes: ['moderator:read:followers', 'channel:read:subscriptions'] },
      bot: { id: "channel", login: "streamer", scopes: [] },
      channel: {
        id: "channel",
        login: "streamer",
        name: "Streamer",
        title: "Game dev",
        categoryId: "1",
        categoryName: "Development",
      },
      canManage: true,
      canModerate: true,
      canChat: true,
    };
    expect(streamSetupProgress(value).ready).toBe(false);
    value.outputReviewed = true;
    expect(streamSetupProgress(value).ready).toBe(true);
    value.obs.snapshot!.observedAt = "2000-01-01T00:00:00.000Z";
    expect(streamSetupProgress(value).ready).toBe(false);
    value.obs.snapshot!.observedAt = new Date().toISOString();
    value.obs.connection = "reconnecting";
    expect(streamSetupProgress(value).ready).toBe(false);
  });
  it("persists dismissal/reopen and does not complete an unverified setup or publish after a failed write", async () => {
    const storage = new MemoryStorage();
    const timers = nodeTimers();
    const runner = createDemoRunner(timers);
    const studio = new StudioService(storage, {
      timers,
      runners: { demo: runner, claude: runner },
      probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
    });
    await studio.start();
    const events: string[] = [];
    studio.onEvent((event) => {
      events.push(event.type);
    });
    await studio.updateStreamSetup("dismiss");
    expect(studio.state().setupGuide?.dismissed).toBe(true);
    expect((await storage.load()).data?.setupGuide?.dismissed).toBe(true);
    await studio.updateStreamSetup("open");
    await expect(studio.updateStreamSetup("complete", true)).rejects.toThrow();
    storage.failNextSave = true;
    await expect(studio.updateStreamSetup("dismiss")).rejects.toThrow();
    expect(events.filter((event) => event === "stream-setup-dismissed")).toHaveLength(1);
    expect(studio.state().setupGuide?.dismissed).toBe(false);
    await studio.stop();
  });
});
