import type { MusicLibrary, MusicPlaylist, MusicState } from "../domain/music";
export interface MusicLibraryPort {
  load(): Promise<MusicLibrary>;
  configure(folder: string): Promise<void>;
  savePlaylist(playlist: MusicPlaylist): Promise<void>;
  openMetadata(trackId: string): Promise<void>;
}
export interface MusicPlayerEvent {
  kind: "progress" | "paused" | "ended" | "error";
  position: number;
  duration: number;
}
export interface MusicPlayerPort {
  play(trackId: string): Promise<void>;
  resume(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  volume(value: number): void;
  subscribe(listener: (event: MusicPlayerEvent) => void): () => void;
  dispose(): void;
}
export interface MusicActions {
  snapshot(): MusicState;
  subscribe(listener: (state: MusicState) => void): () => void;
  refresh(): Promise<void>;
  configure(folder: string): Promise<void>;
  savePlaylist(playlist: MusicPlaylist): Promise<void>;
  openMetadata(trackId: string): Promise<void>;
  playPlaylist(id: string): Promise<void>;
  selectPlaylist?(id: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  skip(direction: -1 | 1): Promise<void>;
  seek(seconds: number): Promise<void>;
  volume(value: number): Promise<void>;
}
