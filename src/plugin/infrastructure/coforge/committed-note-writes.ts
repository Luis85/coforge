/** Exact current-byte receipts are published only after the enclosing canonical save succeeds. */
export class CommittedNoteWrites {
  private readonly active = new Set<Promise<void>>();
  private readonly committed = new Map<string, string>();
  private readonly delivered = new Map<string, string>();
  private readonly queued = new Map<string, { dirty: boolean }>();
  private revision = 0;
  async reset(): Promise<void> {
    while (this.active.size) await Promise.all(this.active);
    this.committed.clear(); this.delivered.clear(); this.revision++;
  }
  begin() {
    const notes = new Map<string, string>(); let finish = () => {};
    const pending = new Promise<void>(resolve => { finish = resolve; }); this.active.add(pending);
    return {
      record: (path: string, bytes: string) => { notes.set(path, bytes); },
      commit: () => { for (const [path, bytes] of notes) { this.committed.set(path, bytes); this.delivered.delete(path); } this.revision++; },
      settle: () => { this.active.delete(pending); finish(); },
    };
  }
  forget(path: string): void { this.committed.delete(path); this.delivered.delete(path); }
  observe(path: string, read: () => Promise<string | undefined>, deliver: (bytes: string) => void, unavailable: () => void): void {
    const existing = this.queued.get(path); if (existing) { existing.dirty = true; return; }
    const item = { dirty: true }; this.queued.set(path, item);
    void (async () => {
      try {
        while (item.dirty) {
          while (this.active.size) await Promise.all(this.active);
          item.dirty = false; const revision = this.revision;
          const bytes = await read();
          if (this.active.size || revision !== this.revision) { item.dirty = true; continue; }
          if (bytes === undefined) continue;
          if (this.committed.get(path) === bytes) { this.delivered.delete(path); continue; }
          if (this.delivered.get(path) === bytes) continue;
          this.delivered.set(path, bytes); deliver(bytes);
        }
      } catch { unavailable(); }
      finally { this.queued.delete(path); }
    })();
  }
}
export type NoteWriteCommit = ReturnType<CommittedNoteWrites['begin']>;
