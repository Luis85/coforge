import { describe, expect, it } from "vitest";
import { readTwitchMetrics } from "../../../infrastructure/coforge/twitch-metrics";
import { TwitchApi } from "../../../infrastructure/coforge/twitch-api";
import { TwitchAccounts, STREAMER_SCOPES } from "../../../infrastructure/coforge/twitch-auth";
import { defaultIntegration } from "../../../features/coforge/domain/seed";
import type { HttpRequest } from "../../../infrastructure/coforge/twitch-http";

describe("Twitch metric totals", () => {
  it("reads live viewers and follower/subscriber totals with the granted scopes, retaining no identities", async () => {
    const config = { ...defaultIntegration(), twitchClientId: "client", twitchBroadcasterId: "123" };
    const request: HttpRequest = async (input) => {
      const url = new URL(input.url);
      if (url.pathname.endsWith("/validate"))
        return {
          status: 200,
          json: { client_id: "client", user_id: "123", login: "streamer", scopes: STREAMER_SCOPES },
        };
      if (url.pathname.endsWith("/streams"))
        return {
          status: 200,
          json: { data: [{ user_id: "123", id: "100", started_at: "2026-10-27T10:00:00Z", viewer_count: 0 }] },
        };
      if (url.pathname.endsWith("/channels/followers"))
        return { status: 200, json: { total: 7, data: [{ user_id: "private-follower" }] } };
      if (url.pathname.endsWith("/subscriptions"))
        return { status: 200, json: { total: 3, points: 8, data: [{ user_id: "private-subscriber" }] } };
      return {
        status: 200,
        json: {
          data: [
            {
              broadcaster_id: "123",
              broadcaster_login: "streamer",
              broadcaster_name: "Streamer",
              title: "Building a game",
              game_id: "42",
              game_name: "Development",
            },
          ],
        },
      };
    };
    const api = new TwitchApi(
      request,
      new TwitchAccounts(request, { getSecret: () => "fixture-only", setSecret: () => undefined }, () => config),
      () => config,
    );
    const result = await readTwitchMetrics(api);
    expect(result).toMatchObject({
      state: "live",
      viewers: 0,
      followers: 7,
      subscribers: 3,
      subscriptionPoints: 8,
      unavailable: [],
    });
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(STREAMER_SCOPES).toContain("channel:read:subscriptions");
    expect(STREAMER_SCOPES).not.toContain("moderator:read:followers");
  });
  it("keeps permission/network failures null and does not expose raw causes or invent zeroes", async () => {
    const fail = async () => {
      throw new Error("raw-private-provider-cause");
    };
    const result = await readTwitchMetrics({
      metricStream: fail,
      channel: fail,
      followerTotal: fail,
      subscriptionTotals: fail,
    });
    expect(result).toMatchObject({
      state: "unavailable",
      viewers: null,
      followers: null,
      subscribers: null,
      subscriptionPoints: null,
    });
    expect(result.unavailable).toEqual(["stream", "channel", "followers", "subscriptions"]);
    expect(JSON.stringify(result)).not.toContain("raw-private");
  });
});
