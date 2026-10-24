import { normalizePath, parseYaml, stringifyYaml, TFile, type Plugin } from 'obsidian';
import type { ExternalNoteChange, InternalState, LoadedStudio, NoteIdea, SaveOptions, StudioStorage } from '../../features/coforge/application/ports';
import { applyIdeaProperties, descriptionFromBody, ideaBody, ideaFileName, ideaProperties, isIdeaFrontmatter, OWNED_PROPERTIES, parseIdeaNote } from '../../features/coforge/domain/idea-note';
import { omit } from '../../features/coforge/domain/objects';
import { cleanText } from '../../features/coforge/domain/sanitize';
import { parsePersistedStudio, type PersistedStudio } from '../../features/coforge/domain/persisted';
import { defaultIntegration } from '../../features/coforge/domain/seed';
import type { Idea } from '../../features/coforge/domain/types';

/** Splits a Markdown note into its YAML frontmatter and body. */
export function splitNote(content: string): { yaml: string | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return match ? { yaml: match[1] ?? '', body: content.slice(match[0].length) } : { yaml: null, body: content };
}

/** Reads an idea from note text, or returns null for notes that are not CoForge ideas. Throws for invalid idea notes. */
export function readIdeaNote(content: string): NoteIdea | null {
  const { yaml, body } = splitNote(content);
  if (yaml === null) return null;
  const frontmatter: unknown = parseYaml(yaml);
  return isIdeaFrontmatter(frontmatter) ? parseIdeaNote(frontmatter, body) : null;
}

const inFolder = (path: string, folder: string) => path.startsWith(`${normalizePath(folder)}/`);
const noteValues = (idea: Idea, author: string) => JSON.stringify(ideaProperties(idea, author));
/** Order-independent fingerprint of the CoForge-owned properties, as written or as read back from YAML. */
function ownedFingerprint(properties: Record<string, unknown>): string {
  return JSON.stringify(OWNED_PROPERTIES.filter(key => properties[key] !== undefined)
    .map(key => { const value = properties[key]; return [key, value instanceof Date ? value.toISOString() : value]; }));
}

/**
 * Idea notes in a vault folder plus `coforge-state.json` in the plugin folder for votes, increments,
 * contributors, chat, runs and settings. Notes keep their body bytes and unrelated properties.
 */
export class VaultStudioStorage implements StudioStorage {
  private readonly paths = new Map<string, string>();
  /** Fingerprints of note writes not yet echoed back by the metadata cache, per note path. */
  private readonly echoes = new Map<string, string[]>();
  private folder = defaultIntegration().ideasFolder;
  constructor(private readonly plugin: Plugin) {}

  get dataPath(): string {
    const { manifest, app } = this.plugin;
    return normalizePath(`${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-state.json`);
  }

  async load(): Promise<LoadedStudio> {
    const adapter = this.plugin.app.vault.adapter;
    const data: PersistedStudio | null = await adapter.exists(this.dataPath) ? parsePersistedStudio(JSON.parse(await adapter.read(this.dataPath))) : null;
    this.folder = data?.integration.ideasFolder ?? this.folder;
    this.paths.clear();
    const notes: NoteIdea[] = []; const invalidNotes: string[] = [];
    for (const file of this.plugin.app.vault.getMarkdownFiles().filter(f => inFolder(f.path, this.folder))) {
      try {
        const idea = readIdeaNote(await this.plugin.app.vault.cachedRead(file));
        if (!idea) continue;
        notes.push(idea); this.paths.set(idea.id, file.path);
      } catch { invalidNotes.push(file.path); }
    }
    return { data, notes, invalidNotes };
  }

  async save(next: InternalState, previous: InternalState | null, options: SaveOptions = {}): Promise<void> {
    if (next.integration.ideasFolder !== this.folder) await this.moveFolder(next.integration.ideasFolder);
    const external = new Set(options.fromNotes ?? []);
    if (options.replaceAll) await this.retireAll();
    const authors = new Map(next.contributors.map(c => [c.id, c.name]));
    for (const idea of next.ideas) {
      if (external.has(idea.id)) continue;
      const author = authors.get(idea.authorId) ?? idea.authorId;
      const before = previous?.ideas.find(i => i.id === idea.id);
      if (before && noteValues(before, authors.get(before.authorId) ?? before.authorId) === noteValues(idea, author) && this.paths.has(idea.id)) continue;
      await this.writeIdea(idea, author);
    }
    for (const idea of previous?.ideas ?? []) {
      if (external.has(idea.id) || next.ideas.some(i => i.id === idea.id)) continue;
      const file = this.file(idea.id);
      if (file) await this.plugin.app.fileManager.trashFile(file);
      this.paths.delete(idea.id);
    }
    await this.plugin.app.vault.adapter.write(this.dataPath, JSON.stringify(this.persisted(next), null, 2));
  }

  /** Reports edits, deletions and renames of idea notes made in the vault. */
  watch(onChange: (change: ExternalNoteChange) => void, onInvalid: (path: string) => void): void {
    const { vault, metadataCache } = this.plugin.app;
    this.plugin.registerEvent(metadataCache.on('changed', (file, data) => {
      if (!inFolder(file.path, this.folder)) return;
      if (this.isEcho(file.path, data)) return;
      let idea: NoteIdea | null;
      try { idea = readIdeaNote(data); } catch { onInvalid(file.path); return; }
      if (!idea) return;
      const known = this.paths.get(idea.id);
      if (known && known !== file.path && this.plugin.app.vault.getFileByPath(known)) { onInvalid(file.path); return; }
      this.paths.set(idea.id, file.path);
      onChange({ kind: 'upsert', idea });
    }));
    this.plugin.registerEvent(vault.on('delete', file => {
      for (const [id, path] of this.paths) if (path === file.path) { this.paths.delete(id); onChange({ kind: 'remove', id }); }
    }));
    this.plugin.registerEvent(vault.on('rename', (file, oldPath) => {
      for (const [id, path] of this.paths) {
        if (path !== oldPath) continue;
        if (inFolder(file.path, this.folder)) this.paths.set(id, file.path);
        else { this.paths.delete(id); onChange({ kind: 'remove', id }); }
      }
    }));
  }

  /** The note for an idea, if it exists. */
  file(id: string): TFile | null {
    const path = this.paths.get(id);
    return path ? this.plugin.app.vault.getFileByPath(path) : null;
  }

  private persisted(state: InternalState): PersistedStudio {
    const { ideas } = state;
    return {
      ...omit(state, 'ideas', 'runtime'),
      votes: Object.fromEntries(ideas.filter(i => i.voters.length).map(i => [i.id, i.voters])),
      increments: Object.fromEntries(ideas.flatMap(i => i.increment ? [[i.id, i.increment] as const] : [])),
    };
  }

  /** CoForge's own writes come back as change events; they must not re-apply older values over newer state. */
  private isEcho(path: string, data: string): boolean {
    const pending = this.echoes.get(path);
    if (!pending?.length) return false;
    let frontmatter: unknown;
    try { frontmatter = parseYaml(splitNote(data).yaml ?? ''); } catch { return false; }
    if (!frontmatter || typeof frontmatter !== 'object') return false;
    // The body description is part of the key, so an edit to the note text is never mistaken for an echo.
    const { body } = splitNote(data);
    const index = pending.indexOf(`${ownedFingerprint(frontmatter as Record<string, unknown>)}\n${descriptionFromBody(body, '')}`);
    if (index === -1) return false;
    pending.splice(0, index + 1);
    return true;
  }

  private remember(path: string, idea: Idea, author: string): void {
    this.echoes.set(path, [...(this.echoes.get(path) ?? []), `${ownedFingerprint(ideaProperties(idea, author))}\n${cleanText(idea.description, 3000)}`].slice(-20));
  }

  private async writeIdea(idea: Idea, author: string): Promise<void> {
    const file = this.file(idea.id);
    if (file) this.remember(file.path, idea, author);
    if (file) { await this.plugin.app.fileManager.processFrontMatter(file, frontmatter => { applyIdeaProperties(frontmatter as Record<string, unknown>, idea, author); }); return; }
    await this.ensureFolder(this.folder);
    let path = normalizePath(`${this.folder}/${ideaFileName(idea)}`);
    for (let n = 2; this.plugin.app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${this.folder}/${ideaFileName(idea).replace(/\.md$/, ` ${n}.md`)}`);
    this.remember(path, idea, author);
    const created = await this.plugin.app.vault.create(path, `---\n${stringifyYaml(ideaProperties(idea, author))}---\n${ideaBody(idea)}`);
    this.paths.set(idea.id, created.path);
  }

  /** Moves every known idea note to the vault trash (reversible). */
  private async retireAll(): Promise<void> {
    for (const id of this.paths.keys()) {
      const file = this.file(id);
      this.paths.delete(id);
      if (file) await this.plugin.app.fileManager.trashFile(file);
    }
  }

  private async moveFolder(target: string): Promise<void> {
    // Switch first so the rename events of the moved notes are recognized as staying inside the ideas folder.
    this.folder = target;
    await this.ensureFolder(target);
    for (const [id, path] of this.paths) {
      const file = this.plugin.app.vault.getFileByPath(path);
      if (!file) continue;
      let destination = normalizePath(`${target}/${file.name}`);
      for (let n = 2; this.plugin.app.vault.getAbstractFileByPath(destination); n++) destination = normalizePath(`${target}/${file.basename} ${n}.md`);
      await this.plugin.app.fileManager.renameFile(file, destination);
      this.paths.set(id, destination);
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    const path = normalizePath(folder);
    if (!this.plugin.app.vault.getAbstractFileByPath(path)) await this.plugin.app.vault.createFolder(path);
  }
}
