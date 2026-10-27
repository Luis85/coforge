import { describe, expect, it, vi } from "vitest";
import { PlayerModeration } from "../../../features/coforge/application/player-moderation";
import { IntegrationFailure } from "../../../features/coforge/domain/integration-failure";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import { emptyStore, registerTestViewers } from "./memory-storage";
import type { ChannelRestriction } from "../../../features/coforge/application/integration-ports";

describe("moderation application boundary", () => {
  it("holds an unconfirmed operation through restart and permits another only after an authoritative refresh", async () => {
    const { store, storage } = await emptyStore();
    await registerTestViewers(store, [{ username: "Viewer", userId: "99", source: "twitch" }]);
    const moderate = vi.fn(async () => {
      throw new IntegrationFailure("uncertain", "Check the channel before another action.");
    });
    const service = new PlayerModeration(store, { moderate, restrictions: async () => [] }, () => "123");
    await expect(service.execute({ type: "ban", userId: "99", reason: "Reviewed" })).rejects.toThrow(
      "Check the channel",
    );
    const restarted = new StudioStore(storage);
    await restarted.init();
    expect(restarted.snapshot().population?.players[0]?.moderationPending?.channelId).toBe("123");
    await expect(service.execute({ type: "ban", userId: "99", reason: "Reviewed" })).rejects.toThrow("unconfirmed");
    expect(moderate).toHaveBeenCalledOnce();
    await service.refresh("99");
    expect(store.snapshot().population?.players[0]?.moderationPending).toBeUndefined();
  });
  it("does not let an older status read overwrite a newer confirmed ban", async () => {
    const { store } = await emptyStore();
    await registerTestViewers(store, [{ username: "Viewer", userId: "99", source: "twitch" }]);
    let resolve!: (value: ChannelRestriction[]) => void;
    const waiting = new Promise<ChannelRestriction[]>((done) => {
      resolve = done;
    });
    const service = new PlayerModeration(
      store,
      { moderate: async () => undefined, restrictions: async () => waiting },
      () => "123",
    );
    const read = service.refresh("99");
    await service.execute({ type: "ban", userId: "99", reason: "Reviewed" });
    resolve([]);
    await read;
    expect(store.snapshot().population?.players[0]?.restriction).toMatchObject({ channelId: "123", banned: true });
  });
  it("does not perform an external action when its intent cannot be persisted", async () => {
    const { store, storage } = await emptyStore();
    await registerTestViewers(store, [{ username: "Viewer", userId: "99", source: "twitch" }]);
    const moderate = vi.fn(async () => undefined);
    const service = new PlayerModeration(store, { moderate, restrictions: async () => [] }, () => "123");
    storage.failNextSave = true;
    await expect(service.execute({ type: "timeout", userId: "99", duration: 600, reason: "" })).rejects.toThrow(
      "Disk full",
    );
    expect(moderate).not.toHaveBeenCalled();
  });
});
