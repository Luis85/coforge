import {
  emptyMusic,
  musicFolder,
  musicTrackPath,
  type MusicOperation,
  type MusicPlaylist,
  type MusicState,
} from "../domain/music";
import type {
  MusicActions,
  MusicLibraryPort,
  MusicPlayerPort,
  MusicPlayerEvent,
} from "./music-ports";

/** One playback owner per plugin, independent of view lifetimes. No startup/go-live autoplay. */
export class MusicService implements MusicActions {
  private readonly state = emptyMusic();
  private readonly listeners = new Set<(state: MusicState) => void>();
  private readonly unsubscribe: () => void;
  private closed = false;
  private generation = 0;
  private endedPending: { generation: number; event: MusicPlayerEvent } | null =
    null;
  constructor(
    private readonly library: MusicLibraryPort,
    private readonly player: MusicPlayerPort,
    private readonly event: (code: MusicOperation) => Promise<void>,
  ) {
    this.player.volume(this.state.playback.volume);
    this.unsubscribe = player.subscribe((value) => this.observe(value));
  }
  snapshot(): MusicState {
    return structuredClone(this.state);
  }
  subscribe(listener: (state: MusicState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(): void {
    if (!this.closed)
      for (const listener of this.listeners) {
        try {
          listener(this.snapshot());
        } catch {
          /* Isolate views. */
        }
      }
  }
  private async command(work: () => Promise<void>): Promise<void> {
    if (this.closed)
      throw new Error("The music player is closed. Reopen CoForge.");
    if (this.state.busy)
      throw new Error("A music interaction is already in progress.");
    this.state.busy = true;
    this.state.error = "";
    this.publish();
    try {
      await work();
    } catch (error) {
      if (!this.closed)
        this.state.error =
          error instanceof Error
            ? error.message
            : "Music could not be updated.";
      throw error;
    } finally {
      this.state.busy = false;
      this.publish();
      const pending = this.endedPending;
      this.endedPending = null;
      if (pending && pending.generation === this.generation)
        this.observe(pending.event);
    }
  }
  private async read(): Promise<void> {
    this.state.library = await this.library.load();
    const current = this.state.playback.queue[this.state.playback.index];
    if (
      current &&
      !this.state.library.tracks.some((track) => track.id === current)
    ) {
      this.halt();
      this.state.error =
        "The playing file is missing. Refresh the library and review the playlist.";
    }
  }
  refresh(): Promise<void> {
    return this.command(async () => {
      await this.read();
      await this.event("music-library-refreshed");
    });
  }
  configure(folder: string): Promise<void> {
    return this.command(async () => {
      await this.library.configure(musicFolder(folder));
      this.halt();
      this.state.playback.queue = [];
      await this.read();
      await this.event("music-settings-saved");
    });
  }
  savePlaylist(input: MusicPlaylist): Promise<void> {
    return this.command(async () => {
      const name = input.name.trim();
      if (
        !name ||
        name.length > 100 ||
        input.tracks.length > 500 ||
        input.tracks.some(
          (path) => !musicTrackPath(path, this.state.library.folder),
        )
      )
        throw new Error(
          "Give the playlist a name and choose up to 500 MP3 files from this library.",
        );
      await this.library.savePlaylist({ ...input, name });
      await this.read();
      await this.event("music-playlist-saved");
    });
  }
  openMetadata(trackId: string): Promise<void> {
    return this.command(async () => {
      if (!this.state.library.tracks.some((track) => track.id === trackId))
        throw new Error("This track is missing. Refresh the library.");
      await this.library.openMetadata(trackId);
      await this.read();
      await this.event("music-metadata-opened");
    });
  }
  playPlaylist(id: string): Promise<void> {
    return this.command(async () => {
      const playlist = this.state.library.playlists.find(
        (item) => item.id === id,
      );
      if (!playlist?.tracks.length)
        throw new Error(
          "Save a playlist with at least one track before playing.",
        );
      if (
        playlist.tracks.some(
          (id) => !this.state.library.tracks.some((track) => track.id === id),
        )
      )
        throw new Error(
          "This playlist has missing files. Remove or restore them before playing.",
        );
      this.halt();
      this.state.playback.queue = [...playlist.tracks];
      this.state.playback.playlist = playlist.name;
      this.state.playback.index = 0;
      await this.playCurrent();
    });
  }
  private async playCurrent(): Promise<void> {
    const id = this.state.playback.queue[this.state.playback.index];
    if (!id || !this.state.library.tracks.some((track) => track.id === id))
      throw new Error(
        "The next music file is missing. Refresh and review the playlist.",
      );
    const generation = ++this.generation;
    this.state.playback.phase = "loading";
    this.state.playback.position = 0;
    this.state.playback.duration = 0;
    this.publish();
    try {
      await this.event("music-playback-requested");
      if (this.closed || generation !== this.generation) return;
      await this.player.play(id);
      if (this.closed || generation !== this.generation) return;
      this.state.playback.phase = "playing";
      await this.event("music-playback-started");
    } catch {
      if (!this.closed && generation === this.generation) {
        this.player.stop();
        this.state.playback.phase = "error";
        await this.event("music-playback-failed").catch(() => undefined);
      }
      throw new Error(
        "Music could not play. Check the local MP3 file and your audio output, then try again.",
      );
    }
  }
  pause(): Promise<void> {
    return this.command(async () => {
      if (this.state.playback.phase !== "playing") return;
      this.player.pause();
      this.state.playback.phase = "paused";
      await this.event("music-playback-paused");
    });
  }
  resume(): Promise<void> {
    return this.command(async () => {
      if (this.state.playback.phase !== "paused") return;
      try {
        await this.player.resume();
        this.state.playback.phase = "playing";
        await this.event("music-playback-started");
      } catch {
        this.halt();
        throw new Error(
          "Music could not resume. Check the file and audio output.",
        );
      }
    });
  }
  private halt(): void {
    this.generation++;
    this.player.stop();
    this.state.playback.phase = "stopped";
    this.state.playback.position = 0;
  }
  stop(): Promise<void> {
    if (this.state.busy && !this.closed) { this.halt(); this.publish(); return this.event('music-playback-stopped'); }
    return this.command(async () => {
      this.halt();
      await this.event("music-playback-stopped");
    });
  }
  skip(direction: -1 | 1): Promise<void> {
    return this.command(async () => {
      const index = this.state.playback.index + direction;
      if (index < 0 || index >= this.state.playback.queue.length) return;
      this.player.stop();
      this.state.playback.index = index;
      await this.playCurrent();
    });
  }
  seek(seconds: number): Promise<void> {
    return this.command(async () => {
      if (
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > this.state.playback.duration
      )
        throw new Error("Choose a position within this track.");
      this.player.seek(seconds);
      this.state.playback.position = seconds;
      await this.event("music-position-changed");
    });
  }
  volume(value: number): Promise<void> {
    return this.command(async () => {
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new Error("Choose a volume between 0 and 100%.");
      this.player.volume(value);
      this.state.playback.volume = value;
      await this.event("music-volume-changed");
    });
  }
  private observe(value: MusicPlayerEvent): void {
    if (this.closed) return;
    if (value.kind === "ended" && this.state.busy) {
      this.endedPending = { generation: this.generation, event: value };
      return;
    }
    if (Number.isFinite(value.position))
      this.state.playback.position = Math.max(0, value.position);
    if (Number.isFinite(value.duration))
      this.state.playback.duration = Math.max(0, value.duration);
    if (value.kind === "error") {
      this.halt();
      this.state.playback.phase = "error";
      this.state.error =
        "The local audio file could not be read. Refresh the library and check the MP3.";
      void this.event("music-playback-failed").catch(() => undefined);
    }
    if (value.kind === "paused" && this.state.playback.phase === "playing")
      this.state.playback.phase = "paused";
    if (value.kind === "ended" && this.state.playback.phase === "playing") {
      const generation = this.generation;
      void this.command(async () => {
        await this.event("music-track-ended");
        if (this.closed || generation !== this.generation) return;
        if (this.state.playback.index + 1 < this.state.playback.queue.length) {
          this.state.playback.index++;
          await this.playCurrent();
        } else {
          this.player.stop();
          this.state.playback.phase = "ended";
        }
      }).catch(() => undefined);
    }
    this.publish();
  }
  async dispose(): Promise<void> {
    this.closed = true;
    this.generation++;
    this.unsubscribe();
    this.player.dispose();
    this.listeners.clear();
  }
}
