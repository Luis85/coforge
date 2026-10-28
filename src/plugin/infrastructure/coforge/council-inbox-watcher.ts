import {
  TFile,
  TFolder,
  type TAbstractFile,
  type EventRef,
  type Vault,
  type MetadataCache,
} from "obsidian";
import {
  routeIntake,
  type IntakeBinding,
  type IntakeCandidate,
} from "../../features/coforge/domain/intake-bindings";
import type { CouncilSourceNotes } from "./council-source-notes";

interface InboxTimers {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}
export interface CouncilInboxObserver {
  changed?(event: CouncilVaultChange): void;
  candidates(
    binding: IntakeBinding,
    notes: IntakeCandidate[],
    now: number,
  ): Promise<void>;
  error(path: string, reason: string): void;
}
export interface CouncilVaultChange {
  metadataOnly?: boolean;
  kind: "create" | "modify" | "delete" | "rename";
  path: string;
  oldPath?: string;
  folder: boolean;
}
/** One indexed event service. Host events only produce candidates, never invoke a provider. */
export class CouncilInboxWatcher {
  private bindings: readonly IntakeBinding[] = [];
  private readonly refs: EventRef[] = [];
  private metadataRef?: EventRef;
  private readonly paths = new Set<string>();
  private readonly pending = new Map<
    string,
    { at: number; followUp: boolean }
  >();
  private readonly cached = new Map<string, IntakeCandidate>();
  private readonly yields = new Map<number, () => void>();
  private timer?: number;
  private disposed = false;
  private draining: Promise<void> = Promise.resolve();
  constructor(
    private readonly vault: Pick<Vault, "on" | "offref" | "getMarkdownFiles">,
    private readonly sources: CouncilSourceNotes,
    private readonly observer: CouncilInboxObserver,
    private readonly timers: InboxTimers,
    private readonly now: () => number = Date.now,
    private readonly metadataCache?: Pick<MetadataCache, "on" | "offref">,
  ) {}
  async start(bindings: readonly IntakeBinding[]): Promise<void> {
    if (this.refs.length)
      throw new Error("Inbox observation is already running.");
    this.disposed = false;
    this.bindings = structuredClone(bindings);
    this.refs.push(
      this.vault.on("create", (file) => {
        this.observe("create", file);
      }),
    );
    this.refs.push(
      this.vault.on("modify", (file) => {
        this.observe("modify", file);
      }),
    );
    this.refs.push(
      this.vault.on("delete", (file) => {
        this.observe("delete", file);
      }),
    );
    this.refs.push(
      this.vault.on("rename", (file, oldPath) => {
        this.observe("rename", file, oldPath);
      }),
    );
    this.metadataRef = this.metadataCache?.on("changed", (file) =>
      this.observer.changed?.({
        kind: "modify",
        path: file.path,
        folder: false,
        metadataOnly: true,
      }),
    );
    await this.reindex();
  }
  private observe(
    kind: CouncilVaultChange["kind"],
    file: TAbstractFile,
    oldPath?: string,
  ): void {
    this.observer.changed?.({
      kind,
      path: file.path,
      ...(oldPath ? { oldPath } : {}),
      folder: file instanceof TFolder,
    });
    if (kind === "delete") this.sources.removed(file.path);
    if (kind === "rename" && oldPath) this.sources.renamed(oldPath, file.path);
    if (kind === "delete" || kind === "rename") {
      const previous = oldPath ?? file.path;
      for (const path of this.paths)
        if (path === previous || path.startsWith(`${previous}/`)) {
          this.paths.delete(path);
          this.pending.delete(path);
          this.cached.delete(path);
        }
    }
    if (kind !== "delete") this.track(file);
  }
  private track(file: TAbstractFile): void {
    if (file instanceof TFile) this.changed(file.path);
    else if (file instanceof TFolder)
      for (const child of file.children) this.track(child);
  }
  async updateBindings(bindings: readonly IntakeBinding[]): Promise<void> {
    this.bindings = structuredClone(bindings);
    await this.reindex();
  }
  async configure(bindings: readonly IntakeBinding[]): Promise<void> {
    if (this.refs.length) await this.updateBindings(bindings);
    else await this.start(bindings);
  }
  /** Capacity/recovery notification: revisit indexed sources, with no whole-vault scan. */
  async reconcileAll(): Promise<void> {
    for (const binding of this.bindings) {
      if (this.disposed) return;
      const notes = [...this.cached.values()].filter((note) =>
        routeIntake([{ ...binding, enabled: true }], note.path),
      );
      await this.observer.candidates(binding, notes, this.now());
    }
  }
  private async reindex(): Promise<void> {
    this.paths.clear();
    this.cached.clear();
    // Startup/configuration changes inspect paths once. Steady-state events never scan the vault.
    const files = this.vault.getMarkdownFiles();
    for (let index = 0; index < files.length; index++) {
      if (this.disposed) return;
      const path = files[index]!.path;
      try {
        if (
          routeIntake(
            this.bindings.map((binding) => ({ ...binding, enabled: true })),
            path,
          )
        )
          this.paths.add(path);
      } catch {
        this.observer.error(
          path,
          "Inbox routing is ambiguous. Resolve overlapping bindings.",
        );
      }
      if (index % 100 === 99) await this.yield();
    }
    for (const binding of this.bindings) {
      if (this.disposed) return;
      const notes = await this.preview(binding);
      await this.observer.candidates(binding, notes, this.now());
      for (const note of notes)
        this.pending.set(note.path, {
          at: this.now() + binding.settleMs + 50,
          followUp: true,
        });
    }
    this.schedule();
  }
  private yield(): Promise<void> {
    return new Promise((resolve) => {
      const id = this.timers.setTimeout(() => {
        this.yields.delete(id);
        resolve();
      }, 0);
      this.yields.set(id, resolve);
    });
  }
  private changed(path: string): void {
    if (this.disposed) return;
    try {
      if (!routeIntake(this.bindings, path)) return;
      this.paths.add(path);
      this.pending.set(path, { at: this.now() + 50, followUp: false });
      this.schedule();
    } catch {
      this.observer.error(
        path,
        "Inbox routing is ambiguous. Resolve overlapping bindings.",
      );
    }
  }
  private schedule(): void {
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    if (this.disposed || !this.pending.size) return;
    const due = Math.min(...[...this.pending.values()].map((item) => item.at));
    this.timer = this.timers.setTimeout(
      () => {
        this.timer = undefined;
        this.draining = this.draining
          .then(() => this.flush())
          .catch(() =>
            this.observer.error(
              "",
              "Inbox reconciliation failed. Repair storage and refresh the intake.",
            ),
          );
      },
      Math.max(0, due - this.now()),
    );
  }
  private async flush(): Promise<void> {
    if (this.disposed) return;
    const due = [...this.pending].filter(([, item]) => item.at <= this.now());
    for (const [path] of due) this.pending.delete(path);
    const byBinding = new Map<string, string[]>();
    for (const [path] of due) {
      const binding = routeIntake(this.bindings, path);
      if (!binding) continue;
      const paths = byBinding.get(binding.id) ?? [];
      paths.push(path);
      byBinding.set(binding.id, paths);
    }
    for (const binding of this.bindings.filter((item) =>
      byBinding.has(item.id),
    )) {
      if (this.disposed) return;
      for (const path of byBinding.get(binding.id) ?? [])
        await this.readPath(path);
      // Cached siblings detect copied IDs without rereading the configured folder on each event.
      const notes = [...this.cached.values()].filter((note) =>
        routeIntake([binding], note.path),
      );
      if (this.disposed) return;
      await this.observer.candidates(binding, notes, this.now());
      for (const [path, item] of due)
        if (
          byBinding.get(binding.id)?.includes(path) &&
          !item.followUp &&
          binding.settleMs > 0
        ) {
          // Exactly one stability follow-up per event batch; later edits replace its deadline.
          if (!this.pending.has(path))
            this.pending.set(path, {
              at: this.now() + binding.settleMs + 50,
              followUp: true,
            });
        }
    }
    this.schedule();
  }
  async preview(binding: IntakeBinding): Promise<IntakeCandidate[]> {
    const notes: IntakeCandidate[] = [];
    for (const path of this.paths) {
      if (this.disposed) return notes;
      if (!routeIntake([{ ...binding, enabled: true }], path)) continue;
      notes.push(await this.readPath(path));
      if (notes.length % 50 === 0) await this.yield();
    }
    return notes;
  }
  private async readPath(path: string): Promise<IntakeCandidate> {
    let note: IntakeCandidate;
    try {
      note = await this.sources.read(path);
    } catch {
      note = {
        path,
        sourceId: this.sources.knownIdentity(path),
        generation: 0,
        body: "",
        sourceRevision: "invalid",
        draft: false,
        ready: false,
        error:
          "The note is invalid or has a publication conflict. Inspect its YAML and managed result blocks.",
      };
    }
    this.cached.set(path, note);
    return note;
  }
  dispose(): void {
    this.disposed = true;
    for (const ref of this.refs) this.vault.offref(ref);
    if (this.metadataRef) this.metadataCache?.offref(this.metadataRef);
    this.metadataRef = undefined;
    this.refs.length = 0;
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    this.paths.clear();
    this.cached.clear();
    for (const [id, resolve] of this.yields) {
      this.timers.clearTimeout(id);
      resolve();
    }
    this.yields.clear();
  }
}
