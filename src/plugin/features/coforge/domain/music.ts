export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  license: string;
  origin: string;
  attribution: string;
  note: boolean;
}
export interface MusicPlaylist {
  id: string;
  name: string;
  tracks: string[];
  version?: string;
}
export interface MusicLibrary {
  folder: string;
  tracks: MusicTrack[];
  playlists: MusicPlaylist[];
  warnings: number;
}
export interface MusicPlayback {
  phase: "stopped" | "loading" | "playing" | "paused" | "ended" | "error";
  queue: string[];
  index: number;
  playlist: string;
  position: number;
  duration: number;
  volume: number;
}
export interface MusicState {
  selectedPlaylistId?: string;
  library: MusicLibrary;
  playback: MusicPlayback;
  busy: boolean;
  error: string;
}
export const emptyMusic = (): MusicState => ({
  library: { folder: "CoForge/Music", tracks: [], playlists: [], warnings: 0 },
  playback: {
    phase: "stopped",
    queue: [],
    index: 0,
    playlist: "",
    position: 0,
    duration: 0,
    volume: 0.5,
  },
  busy: false,
  error: "",
});
export const MUSIC_OPERATION_CODES = [
  "music-playlist-selected",
  "music-library-refreshed",
  "music-settings-saved",
  "music-playlist-saved",
  "music-metadata-opened",
  "music-playback-requested",
  "music-playback-started",
  "music-playback-paused",
  "music-playback-stopped",
  "music-playback-failed",
  "music-track-ended",
  "music-position-changed",
  "music-volume-changed",
] as const;
export type MusicOperation = (typeof MUSIC_OPERATION_CODES)[number];
export function musicFolder(value: string): string {
  const folder = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (
    !folder ||
    folder.length > 300 ||
    folder
      .split("/")
      .some(
        (part) =>
          !part ||
          part.startsWith(".") ||
          /[:*?"<>|]/.test(part) ||
          [...part].some((char) => char.charCodeAt(0) < 32),
      )
  )
    throw new Error(
      "Choose a relative folder inside the vault, without hidden or parent folders.",
    );
  return folder;
}
export function musicTrackPath(value: string, folder: string): boolean {
  try {
    return (
      musicFolder(value) === value &&
      value.startsWith(folder + "/") &&
      /\.mp3$/i.test(value)
    );
  } catch {
    return false;
  }
}
