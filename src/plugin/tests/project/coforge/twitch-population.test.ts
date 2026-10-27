import { afterEach, describe, expect, it, vi } from "vitest";
import { TwitchAccounts, BOT_SCOPES, STREAMER_SCOPES } from "../../../infrastructure/coforge/twitch-auth";
import { TwitchApi } from "../../../infrastructure/coforge/twitch-api";
import { LivePopulationTracker } from "../../../features/coforge/application/live-population";
import type { HttpRequest } from "../../../infrastructure/coforge/twitch-http";
import type { TwitchState } from "../../../features/coforge/domain/twitch";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { MemoryStorage, nodeTimers, registerTestViewers } from "./memory-storage";

const stops: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const stop of stops.splice(0)) await stop();
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime("2026-10-27T10:00:00Z");
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
  });
  await studio.start();
  await studio.updateIntegration({ twitchClientId: "client", twitchBroadcasterId: "123" });
  await registerTestViewers(studio.store, [{ username: "Viewer", source: "twitch", userId: "99" }]);
  const response = { live: true, chattersFail: false, banned: false };
  let tracking: TwitchState["tracking"];
  const request: HttpRequest = async (input) => {
    if (input.url.endsWith("/validate"))
      return {
        status: 200,
        json: { client_id: "client", user_id: "123", login: "streamer", scopes: [...STREAMER_SCOPES, ...BOT_SCOPES] },
      };
    if (input.url.includes("/streams?"))
      return {
        status: 200,
        json: { data: response.live ? [{ id: "live-1", user_id: "123", started_at: "2026-10-27T09:00:00Z" }] : [] },
      };
    if (input.url.includes("/chat/chatters?"))
      return response.chattersFail
        ? { status: 503, json: {} }
        : { status: 200, json: { data: [{ user_id: "99" }], pagination: {} } };
    if (input.url.includes("/moderation/banned?"))
      return { status: 200, json: { data: response.banned ? [{ user_id: "99", expires_at: "" }] : [] } };
    throw new Error("Unexpected HTTP call");
  };
  const accounts = new TwitchAccounts(request, { getSecret: () => "test-token", setSecret: () => undefined }, () =>
    studio.integration(),
  );
  const api = new TwitchApi(request, accounts, () => studio.integration());
  const population = new LivePopulationTracker(
    studio,
    api,
    timers,
    () => studio.integration(),
    () => true,
    (state) => {
      tracking = state;
    },
  );
  stops.push(async () => {
    population.stop();
    await studio.stop();
  });
  population.start();
  await vi.advanceTimersByTimeAsync(0);
  return { studio, population, response, tracking: () => tracking };
}
describe("live chat-presence tracking", () => {
  it("credits consecutive complete live snapshots, skips offline time, and starts a fresh baseline on return", async () => {
    const env = await setup();
    expect(env.studio.state().population?.players[0]?.coins).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.studio.state().population?.players[0]).toMatchObject({ coins: 1, xp: 1, presenceSeconds: 60 });
    env.response.live = false;
    await vi.advanceTimersByTimeAsync(180_000);
    expect(env.tracking()?.phase).toBe("offline");
    expect(env.studio.state().population?.players[0]?.coins).toBe(1);
    env.response.live = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.studio.state().population?.players[0]?.coins).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.studio.state().population?.players[0]?.coins).toBe(2);
  });
  it("does not backfill across failed snapshots or reward banned players", async () => {
    const env = await setup();
    env.response.chattersFail = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.tracking()?.phase).toBe("error");
    expect(env.studio.state().population?.players[0]?.coins).toBe(0);
    env.response.chattersFail = false;
    await vi.advanceTimersByTimeAsync(60_000);
    env.response.banned = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.studio.state().population?.players[0]).toMatchObject({ coins: 0, restriction: { banned: true } });
    expect(env.studio.state().population?.counters["presence-failed"]).toBe(1);
  });
  it("does not treat malformed ban snapshots as an authoritative unban", async () => {
    const env = await setup();
    const request: HttpRequest = async (input) =>
      input.url.endsWith("/validate")
        ? { status: 200, json: { client_id: "client", user_id: "123", login: "streamer", scopes: STREAMER_SCOPES } }
        : { status: 200, json: {} };
    const accounts = new TwitchAccounts(request, { getSecret: () => "test-token", setSecret: () => undefined }, () =>
      env.studio.integration(),
    );
    await expect(new TwitchApi(request, accounts, () => env.studio.integration()).restrictions(["99"])).rejects.toThrow(
      "incomplete snapshot",
    );
  });
});
