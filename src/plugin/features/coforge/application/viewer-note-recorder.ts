import type { StudioStore } from "./studio-store";
import type { Timers } from "./ports";
import type { ViewerNoteActions, ViewerNoteStorage } from "./viewer-note-ports";
import type { ViewerNote } from "../domain/viewer-notes";
/** Coalesced profile writes are independent of intake and preserve human CRM annotations in storage. */
export class ViewerNoteRecorder implements ViewerNoteActions {
  private timer: number | undefined;
  private work: number | undefined;
  private closed = false;
  private pending: Promise<void> | undefined;
  private readonly queue = new Map<string, ViewerNote>();
  private readonly written = new Map<string, string>();
  private failed = false;
  constructor(
    private readonly store: StudioStore,
    private readonly storage: ViewerNoteStorage,
    private readonly timers: Timers,
    private readonly report: () => void,
  ) {}
  start(): void {
    if (this.timer !== undefined || this.closed) return;
    this.timer = this.timers.setInterval(() => this.capture(), 60000);
    this.capture();
  }
  private capture(): void {
    if (this.closed || !this.store.ready) return;
    for (const profile of this.store.viewerNotesSnapshot())
      if (this.written.get(profile.id) !== JSON.stringify(profile))
        this.queue.set(profile.id, profile);
    this.schedule();
  }
  private schedule(): void {
    if (
      this.closed ||
      this.work !== undefined ||
      this.pending ||
      !this.queue.size
    )
      return;
    this.work = this.timers.setTimeout(() => {
      this.work = undefined;
      void this.flushBatch();
    }, 0);
  }
  private async flushBatch(): Promise<void> {
    if (this.pending) return this.pending;
    const batch = [...this.queue.values()].slice(0, 200);
    this.pending = (async () => {
      this.failed = false;
      for (const profile of batch) {
        try {
          await this.storage.save(profile);
          this.written.set(profile.id, JSON.stringify(profile));
          if (this.queue.get(profile.id) === profile)
            this.queue.delete(profile.id);
        } catch {
          this.failed = true;
          this.queue.delete(profile.id);
          this.queue.set(profile.id, profile);
          this.report();
        }
      }
    })().finally(() => {
      this.pending = undefined;
      if (!this.failed) this.schedule();
    });
    return this.pending;
  }
  status() {
    return {
      pending: this.queue.size,
      saved: this.written.size,
      failed: this.failed,
    };
  }
  async refresh(): Promise<void> {
    if (this.pending) await this.pending;
    await this.storage.refreshIndex?.();
    this.capture();
    await this.flushBatch();
  }
  async open(id: string): Promise<void> {
    const profile = this.store.viewerNotesSnapshot(new Set([id]))[0];
    if (!profile)
      throw new Error("No observed Twitch viewer matches this profile.");
    if (this.pending) await this.pending;
    await this.storage.save(profile);
    this.written.set(id, JSON.stringify(profile));
    this.queue.delete(id);
    await this.storage.open(id);
  }
  async dispose(): Promise<void> {
    if (this.closed) return;
    if (this.timer !== undefined) this.timers.clearInterval(this.timer);
    if (this.work !== undefined) this.timers.clearTimeout(this.work);
    this.work = undefined;
    this.capture();
    this.closed = true;
    if (this.work !== undefined) this.timers.clearTimeout(this.work);
    if (this.pending) await this.pending;
    // A bounded final batch; remaining canonical population data is backfilled on the next startup.
    if (this.queue.size) await this.flushBatch();
  }
}
