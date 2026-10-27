import type { Vault } from "obsidian";
import type {
  MusicPlayerEvent,
  MusicPlayerPort,
} from "../../features/coforge/application/music-ports";

/** Owns one local media element. Old element callbacks are detached before a track switch or unload. */
export class LocalMusicPlayer implements MusicPlayerPort {
  private audio: HTMLAudioElement | null = null;
  private level = 0.5;
  private closed = false;
  private readonly listeners = new Set<(event: MusicPlayerEvent) => void>();
  private detach = () => {};
  constructor(
    private readonly vault: Pick<Vault, "getFileByPath" | "getResourcePath">,
    private readonly create = () => new Audio(),
  ) {}
  subscribe(listener: (event: MusicPlayerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async play(path: string): Promise<void> {
    if (this.closed) throw new Error("Player closed");
    const file = this.vault.getFileByPath(path);
    if (!file || file.extension.toLowerCase() !== "mp3")
      throw new Error("Missing MP3");
    this.stop();
    const audio = this.create();
    this.audio = audio;
    audio.preload = "metadata";
    audio.volume = this.level;
    const handlers = new Map<string, () => void>();
    for (const [name, kind] of [
      ["timeupdate", "progress"],
      ["loadedmetadata", "progress"],
      ["durationchange", "progress"],
      ["pause", "paused"],
      ["ended", "ended"],
      ["error", "error"],
    ] as const) {
      const handler = () => {
        if (this.closed || this.audio !== audio) return;
        if (name === "pause" && audio.ended) return;
        for (const listener of this.listeners)
          listener({
            kind,
            position: audio.currentTime,
            duration: audio.duration,
          });
      };
      handlers.set(name, handler);
      audio.addEventListener(name, handler);
    }
    this.detach = () => {
      for (const [name, handler] of handlers)
        audio.removeEventListener(name, handler);
    };
    audio.src = this.vault.getResourcePath(file);
    await audio.play();
    if (this.closed || this.audio !== audio) audio.pause();
  }
  async resume(): Promise<void> {
    if (this.closed || !this.audio) throw new Error("No track");
    await this.audio.play();
  }
  pause(): void {
    this.audio?.pause();
  }
  stop(): void {
    this.detach();
    this.detach = () => {};
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
  }
  seek(seconds: number): void {
    if (this.audio) this.audio.currentTime = seconds;
  }
  volume(value: number): void {
    this.level = value;
    if (this.audio) this.audio.volume = value;
  }
  dispose(): void {
    this.closed = true;
    this.stop();
    this.listeners.clear();
  }
}
