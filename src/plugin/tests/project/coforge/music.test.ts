import { describe, expect, it, vi } from "vitest";
import { MusicService } from "../../../features/coforge/application/music-service";
import type {
  MusicLibraryPort,
  MusicPlayerPort,
  MusicPlayerEvent,
} from "../../../features/coforge/application/music-ports";
import type { MusicLibrary } from "../../../features/coforge/domain/music";

function kit() {
  let library: MusicLibrary = {
    folder: "CoForge/Music",
    warnings: 0,
    tracks: ["one", "two"].map((id) => ({
      id: `CoForge/Music/${id}.mp3`,
      title: id,
      artist: "",
      license: "CC0",
      origin: "",
      attribution: "",
      note: true,
    })),
    playlists: [
      {
        id: "playlist",
        name: "Evening",
        tracks: ["CoForge/Music/one.mp3", "CoForge/Music/two.mp3"],
        version: "v1",
      },
    ],
  };
  const storage: MusicLibraryPort = {
    load: async () => structuredClone(library),
    configure: async () => {},
    savePlaylist: async () => {},
    openMetadata: async () => {},
  };
  let callback: (event: MusicPlayerEvent) => void = () => {};
  const player: MusicPlayerPort = {
    play: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    volume: vi.fn(),
    subscribe: (listener) => {
      callback = listener;
      return () => {
        callback = () => {};
      };
    },
    dispose: vi.fn(),
  };
  const events: string[] = [];
  const service = new MusicService(storage, player, async (code) => {
    events.push(code);
  });
  return {
    service,
    storage,
    player,
    events,
    emit: (event: MusicPlayerEvent) => callback(event),
    removeTrack: () => {
      library = { ...library, tracks: library.tracks.slice(1) };
    },
  };
}
describe("local music playback", () => {
  it('can stop a pending local play request without letting its completion restart music', async () => {
    const app = kit(); await app.service.refresh();
    let finish!: () => void;
    app.player.play = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const playing = app.service.playPlaylist('playlist');
    await vi.waitFor(() => expect(app.player.play).toHaveBeenCalledOnce());
    await app.service.stop(); expect(app.service.snapshot().playback.phase).toBe('stopped');
    finish(); await playing; expect(app.service.snapshot().playback.phase).toBe('stopped');
    await app.service.dispose();
  });
  it("does not autoplay, advances a saved queue, pauses/resumes and stops on disposal", async () => {
    const app = kit();
    await app.service.refresh();
    expect(app.player.play).not.toHaveBeenCalled();
    await app.service.playPlaylist("playlist");
    expect(app.player.play).toHaveBeenCalledWith("CoForge/Music/one.mp3");
    await app.service.pause();
    expect(app.service.snapshot().playback.phase).toBe("paused");
    await app.service.resume();
    expect(app.player.resume).toHaveBeenCalledOnce();
    app.emit({ kind: "ended", position: 10, duration: 10 });
    await vi.waitFor(() =>
      expect(app.player.play).toHaveBeenLastCalledWith("CoForge/Music/two.mp3"),
    );
    app.emit({ kind: "ended", position: 10, duration: 10 });
    await vi.waitFor(() =>
      expect(app.service.snapshot().playback.phase).toBe("ended"),
    );
    expect(app.events).toContain("music-track-ended");
    await app.service.dispose();
    expect(app.player.dispose).toHaveBeenCalledOnce();
    app.emit({ kind: "ended", position: 10, duration: 10 });
    expect(app.player.play).toHaveBeenCalledTimes(2);
  });
  it("keeps failed saves and missing media visible without starting another track", async () => {
    const app = kit();
    await app.service.refresh();
    app.storage.savePlaylist = async () => {
      throw new Error("Changed externally. Refresh first.");
    };
    await expect(
      app.service.savePlaylist({
        id: "playlist",
        name: "Changed",
        tracks: [],
        version: "v1",
      }),
    ).rejects.toThrow("Changed externally");
    expect(app.service.snapshot().library.playlists[0]?.name).toBe("Evening");
    await app.service.playPlaylist("playlist");
    app.removeTrack();
    await app.service.refresh();
    expect(app.service.snapshot().playback.phase).toBe("stopped");
    await expect(app.service.playPlaylist("playlist")).rejects.toThrow(
      "missing",
    );
    expect(app.player.play).toHaveBeenCalledTimes(1);
  });
});
