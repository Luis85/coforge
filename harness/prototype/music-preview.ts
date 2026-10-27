import { MusicService } from "../../src/plugin/features/coforge/application/music-service";
import type { MusicLibrary } from "../../src/plugin/features/coforge/domain/music";
import type { MusicPlayerEvent } from "../../src/plugin/features/coforge/application/music-ports";
export function createMusicPreview() {
  const library: MusicLibrary = {
    folder: "CoForge/Music",
    warnings: 0,
    tracks: ["Lanterns", "Rooftops"].map((title) => ({
      id: `CoForge/Music/${title}.mp3`,
      title: `Example ${title}`,
      artist: "Example artist",
      license: "Example license — review your own music rights",
      origin: "Synthetic preview, no audio file",
      attribution: "",
      note: true,
    })),
    playlists: [],
  };
  let listener: (event: MusicPlayerEvent) => void = () => {};
  return new MusicService(
    {
      load: async () => structuredClone(library),
      configure: async (folder) => {
        library.folder = folder;
        library.tracks = [];
        library.playlists = [];
      },
      savePlaylist: async (input) => {
        const playlist = {
          ...input,
          id: input.id || crypto.randomUUID(),
          version: crypto.randomUUID(),
        };
        library.playlists = library.playlists.filter(
          (item) => item.id !== playlist.id,
        );
        library.playlists.push(playlist);
      },
      openMetadata: async () => {},
    },
    {
      play: async () => {
        listener({ kind: "progress", position: 0, duration: 180 });
      },
      resume: async () => {},
      pause: () => {},
      stop: () => {},
      seek: (seconds) =>
        listener({ kind: "progress", position: seconds, duration: 180 }),
      volume: () => {},
      subscribe: (callback) => {
        listener = callback;
        return () => {
          listener = () => {};
        };
      },
      dispose: () => {},
    },
    async () => {},
  );
}
