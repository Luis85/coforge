// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { LocalMusicPlayer } from "../../../infrastructure/coforge/local-music-player";
describe("owned local audio element", () => {
  it("uses a vault resource, ignores old track events and releases every element on unload", async () => {
    const app = new App();
    createTestApp({
      app,
      files: { "Music/one.mp3": "fixture", "Music/two.mp3": "fixture" },
    });
    const created: HTMLAudioElement[] = [];
    const player = new LocalMusicPlayer(app.vault, () => {
      const audio = document.createElement("audio");
      vi.spyOn(audio, "play").mockResolvedValue();
      vi.spyOn(audio, "pause").mockImplementation(() => {});
      vi.spyOn(audio, "load").mockImplementation(() => {});
      created.push(audio);
      return audio;
    });
    const observed = vi.fn();
    player.subscribe(observed);
    await player.play("Music/one.mp3");
    expect(created[0]?.src).toContain("Music/one.mp3");
    await player.play("Music/two.mp3");
    expect(created[0]?.getAttribute("src")).toBeNull();
    observed.mockClear();
    created[0]?.dispatchEvent(new Event("ended"));
    expect(observed).not.toHaveBeenCalled();
    created[1]?.dispatchEvent(new Event("timeupdate"));
    expect(observed).toHaveBeenCalledOnce();
    player.dispose();
    expect(created[1]?.getAttribute("src")).toBeNull();
    created[1]?.dispatchEvent(new Event("ended"));
    expect(observed).toHaveBeenCalledOnce();
    await expect(player.play("Music/one.mp3")).rejects.toThrow("closed");
  });
});
