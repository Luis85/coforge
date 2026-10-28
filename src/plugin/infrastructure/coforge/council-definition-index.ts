import { TFile, TFolder, type Plugin } from "obsidian";
import type { CouncilCatalogueSnapshot } from "../../features/coforge/application/council-catalogue";

interface IndexedNote {
  file: TFile;
  path: string;
  markdown: string;
  mtime: number;
  size: number;
  version?: number;
}
/** One startup path scan; later reads follow the shared event service and configured folder subtrees. */
export class CouncilDefinitionIndex {
  private initialized = false;
  private readonly paths = new Set<string>();
  private readonly dirty = new Set<string>();
  private readonly changes = new Map<string, number>();
  private sequence = 0;
  private readonly cached = new Map<string, IndexedNote>();
  constructor(
    private readonly plugin: Plugin,
    private readonly privateLocation: (path: string) => boolean,
  ) {}
  private mark(path: string): void {
    this.dirty.add(path);
    this.changes.set(path, ++this.sequence);
  }
  invalidate(
    path: string,
    oldPath?: string,
    folder = false,
    metadataOnly = false,
  ): void {
    if (metadataOnly && this.paths.has(path)) return;
    const affected = (value: string, parent: string) =>
      value === parent || (folder && value.startsWith(`${parent}/`));
    if (oldPath) {
      const previousPaths = [...this.paths];
      for (const previous of previousPaths)
        if (affected(previous, oldPath)) {
          this.paths.delete(previous);
          this.cached.delete(previous);
          this.dirty.delete(previous);
          const moved = path + previous.slice(oldPath.length);
          this.paths.add(moved);
          this.mark(moved);
        }
    }
    if (folder) {
      for (const known of this.paths)
        if (affected(known, path)) this.mark(known);
    } else this.mark(path);
  }
  private definition(file: TFile): boolean {
    const metadata: unknown =
      this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.coforge;
    return Boolean(
      metadata &&
      typeof metadata === "object" &&
      "schema" in metadata &&
      typeof metadata.schema === "string" &&
      /^(agent|team|council)\//u.test(metadata.schema),
    );
  }
  private scope(
    path: string,
    folders: readonly string[],
    known: ReadonlySet<string>,
  ): boolean {
    return (
      known.has(path) || folders.some((folder) => path.startsWith(`${folder}/`))
    );
  }
  private discoverFolder(folder: TFolder): void {
    for (const child of folder.children) {
      if (child instanceof TFolder) this.discoverFolder(child);
      else if (child instanceof TFile && child.extension === "md")
        this.paths.add(child.path);
    }
  }
  private async stable(file: TFile, path: string): Promise<IndexedNote | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const version = this.changes.get(path);
      const mtime = file.stat.mtime;
      const size = file.stat.size;
      const markdown = await this.plugin.app.vault.read(file);
      if (
        file.path === path &&
        version === this.changes.get(path) &&
        mtime === file.stat.mtime &&
        size === file.stat.size
      )
        return { path, file, markdown, mtime, size, version };
    }
    return null;
  }
  async read(
    folders: readonly string[],
    known: ReadonlySet<string>,
  ): Promise<{
    notes: Array<{ path: string; markdown: string }>;
    invalid: CouncilCatalogueSnapshot["invalid"];
  }> {
    const vault = this.plugin.app.vault;
    if (!this.initialized) {
      for (const file of vault.getMarkdownFiles())
        if (this.scope(file.path, folders, known) || this.definition(file))
          this.paths.add(file.path);
      this.initialized = true;
    }
    // Folder indexes discover ordinary new definitions without enumerating unrelated vault notes.
    for (const folder of folders) {
      const entry = vault.getAbstractFileByPath(folder);
      if (entry instanceof TFolder) this.discoverFolder(entry);
    }
    for (const [path, note] of this.cached)
      if (note.file.path !== path) {
        this.paths.delete(path);
        this.cached.delete(path);
        this.paths.add(note.file.path);
        this.dirty.add(note.file.path);
      }
    for (const path of this.dirty) {
      const file = vault.getFileByPath(path);
      if (!file) {
        this.paths.delete(path);
        this.cached.delete(path);
        this.dirty.delete(path);
        this.changes.delete(path);
        continue;
      }
      if (this.scope(path, folders, known) || this.definition(file))
        this.paths.add(path);
      else if (this.plugin.app.metadataCache.getFileCache(file)) {
        this.dirty.delete(path);
        this.changes.delete(path);
      }
    }
    const notes: Array<{ path: string; markdown: string }> = [];
    const invalid: CouncilCatalogueSnapshot["invalid"] = [];
    const pendingPaths = [...this.paths];
    for (const path of pendingPaths) {
      const file = vault.getFileByPath(path);
      if (!file) {
        this.paths.delete(path);
        this.cached.delete(path);
        continue;
      }
      if (!this.privateLocation(path)) {
        invalid.push({
          path,
          reason:
            "Move this private definition outside public exports, configuration and Git metadata before using it.",
        });
        continue;
      }
      let note = this.cached.get(path);
      if (
        !note ||
        note.file !== file ||
        this.dirty.has(path) ||
        note.mtime !== file.stat.mtime ||
        note.size !== file.stat.size
      ) {
        let current: IndexedNote | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const candidate = await this.stable(file, path);
          if (candidate && candidate.version === this.changes.get(path)) {
            current = candidate;
            break;
          }
        }
        if (!current) {
          invalid.push({
            path,
            reason:
              "The definition changed repeatedly while being read. Let the save settle and refresh before new work.",
          });
          continue;
        }
        note = current;
        this.cached.set(path, note);
      }
      this.dirty.delete(path);
      notes.push({ path, markdown: note.markdown });
    }
    return { notes, invalid };
  }
}
