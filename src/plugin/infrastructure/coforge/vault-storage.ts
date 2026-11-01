import { VaultEconomyReservations } from "./economy-reservations";
import { economyUsageReservationCheck } from "../../features/coforge/domain/command-economy-check";
import type { EconomyUsageReservation } from "../../features/coforge/domain/command-economy";
import { VaultCommandCommit } from "./vault-command-commit";
import { planAtomicCommand, needsAtomicCommand } from "./atomic-command-plan";
import { normalizePath, parseYaml, stringifyYaml, TFile, type Plugin } from 'obsidian';
import type { ExternalNoteChange, InternalState, LoadedStudio, NoteIdea, SaveOptions, StudioStorage } from '../../features/coforge/application/ports';
import { ideaBody, ideaFileName, ideaProperties, isIdeaFrontmatter, parseIdeaNote } from '../../features/coforge/domain/idea-note';
import { omit } from '../../features/coforge/domain/objects';
import { appendContextBody } from '../../features/coforge/domain/idea-context';
import { parsePersistedStudio, type PersistedStudio } from '../../features/coforge/domain/persisted';
import { defaultIntegration } from '../../features/coforge/domain/seed';
import type { Idea } from '../../features/coforge/domain/types';
import { splitNote } from './markdown';
import { VaultProjects, type ProjectNoteChange } from './vault-projects';
import { validateFolderLayout } from '../../features/coforge/domain/vault-folder-policy';
import { protectPrivateData } from './private-data-guard';
import { VaultExampleCleanup } from './vault-example-cleanup';
import { writeManagedIdeaProperties, writeRequestValuesNote } from './request-values-note';
import { CommittedNoteWrites, type NoteWriteCommit } from './committed-note-writes';
import { assertIdeaWriteIdentity } from './idea-note-write-identity';
export { splitNote } from './markdown';

/** Reads an idea from note text, or returns null for notes that are not CoForge ideas. Throws for invalid idea notes. */
export function readIdeaNote(content: string): NoteIdea | null {
  const { yaml, body } = splitNote(content);
  if (yaml === null) return null;
  const frontmatter: unknown = parseYaml(yaml);
  return isIdeaFrontmatter(frontmatter) ? parseIdeaNote(frontmatter, body) : null;
}

const inFolder = (path: string, folder: string) => path.startsWith(`${normalizePath(folder)}/`);
const noteValues = (idea: Idea, author: string) => JSON.stringify(ideaProperties(idea, author));

/**
 * Idea notes in a vault folder plus `coforge-state.json` in the plugin folder for votes, increments,
 * contributors, chat, runs and settings. Notes keep their body bytes and unrelated properties.
 */
export class VaultStudioStorage implements StudioStorage {
  private readonly paths = new Map<string, string>();
  private readonly noteWrites = new CommittedNoteWrites();
  private readonly loadedNotes = new Map<string, NoteIdea>();
  private folder = defaultIntegration().ideasFolder;
  private readonly projects: VaultProjects;
  private readonly cleanup: VaultExampleCleanup;
  private readonly deletion: VaultExampleCleanup;
  private readonly commands: VaultCommandCommit;
  readonly economyReservations: VaultEconomyReservations<EconomyUsageReservation>;
  constructor(private readonly plugin: Plugin, private readonly privateFolders: () => readonly string[] = () => [],
    private readonly assertNoteFoldersAvailable: (folders: readonly string[]) => void = () => undefined) {
    this.projects = new VaultProjects(plugin);
    this.economyReservations = new VaultEconomyReservations(plugin, economyUsageReservationCheck);
    this.commands = new VaultCommandCommit(plugin, this.dataPath, bytes => readIdeaNote(bytes)?.id);
    this.cleanup = new VaultExampleCleanup(plugin, this.dataPath, content => readIdeaNote(content)?.id, () => plugin.app.vault.getMarkdownFiles().filter(file => inFolder(file.path, this.folder)));
    this.deletion = new VaultExampleCleanup(plugin, this.dataPath, content => readIdeaNote(content)?.id, () => plugin.app.vault.getMarkdownFiles().filter(file => inFolder(file.path, this.folder)), 'request');
  }
  previewExampleNotes(ids: readonly string[]): Promise<Record<string, string>> { return this.cleanup.preview(ids, id => this.file(id)); }
  exampleCleanupWarning(): string | undefined { return this.cleanup.warning; }
  previewRequestNotes(ids: readonly string[]): Promise<Record<string, string>> { return this.deletion.preview(ids, id => this.file(id)); }
  requestDeletionWarning(): string | undefined { return this.deletion.warning; }
  private writing(path: string): boolean { return this.cleanup.writing.has(path) || this.deletion.writing.has(path) || this.commands.writing.has(path); }

  projectFile(id: string): TFile | null { return this.projects.file(id); }
  watchProjects(onChange: (change: ProjectNoteChange) => void, onInvalid: (path: string) => void): void { this.projects.watch(onChange, onInvalid); }

  get dataPath(): string {
    const { manifest, app } = this.plugin;
    return normalizePath(`${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-state.json`);
  }

  async load(): Promise<LoadedStudio> {
    await this.noteWrites.reset();
    const adapter = this.plugin.app.vault.adapter;
    await protectPrivateData(this.plugin);
    await this.cleanup.recover();
    await this.deletion.recover();
    await this.commands.recover();
    await this.economyReservations.validate();
    const data: PersistedStudio | null = await adapter.exists(this.dataPath) ? parsePersistedStudio(JSON.parse(await adapter.read(this.dataPath))) : null;
    const integration = data?.integration ?? defaultIntegration();
    const layout = validateFolderLayout(integration, [this.plugin.app.vault.configDir, ...this.privateFolders()]);
    this.assertNoteFoldersAvailable([layout.ideasFolder]);
    if (data) data.integration = { ...data.integration, ...layout };
    await protectPrivateData(this.plugin, layout);
    this.folder = layout.ideasFolder;
    this.paths.clear();
    this.loadedNotes.clear();
    const notes: NoteIdea[] = []; const invalidNotes: string[] = [];
    for (const file of this.plugin.app.vault.getMarkdownFiles().filter(f => inFolder(f.path, this.folder))) {
      try {
        const idea = readIdeaNote(await this.plugin.app.vault.cachedRead(file));
        if (!idea) continue;
        notes.push(idea); this.paths.set(idea.id, file.path); this.loadedNotes.set(idea.id, structuredClone(idea));
      } catch { invalidNotes.push(file.path); }
    }
    const { projects, invalid } = await this.projects.load();
    return { data, notes, projects, invalidNotes: [...invalidNotes, ...invalid] };
  }

  async save(next: InternalState, previous: InternalState | null, options: SaveOptions = {}): Promise<void> {
    const writes = this.noteWrites.begin();
    try { await this.saveCanonical(next, previous, options, writes); writes.commit(); }
    finally { writes.settle(); }
  }
  private async saveCanonical(next: InternalState, previous: InternalState | null, options: SaveOptions, writes: NoteWriteCommit): Promise<void> {
    this.economyReservations.assertReady();
    await this.cleanup.settleBeforeSave();
    await this.deletion.settleBeforeSave();
    await this.commands.settleBeforeSave();
    const layout = validateFolderLayout(next.integration, [this.plugin.app.vault.configDir, ...this.privateFolders()]);
    this.assertNoteFoldersAvailable([layout.ideasFolder]);
    next.integration = { ...next.integration, ...layout };
    await protectPrivateData(this.plugin, layout);
    if (needsAtomicCommand(next, previous, options)) {
      if (!previous || options.exampleCleanup || options.requestDeletion || options.replaceAll || options.fromNotes?.length || options.fromProjects?.length || options.requestValuesEdit)
        throw new Error("Atomic commands require a current canonical session without unrelated note or cleanup effects.");
      const plan = await planAtomicCommand({ plugin: this.plugin, next, previous, dataPath: this.dataPath,
        beforeData: JSON.stringify(this.persisted(previous), null, 2), afterData: JSON.stringify(this.persisted(next), null, 2),
        folder: this.folder, file: id => this.file(id), read: readIdeaNote });
      await this.ensureFolder(this.folder);
      await this.commands.commit(plan);
      for (const note of plan.notes) { this.paths.set(note.id, note.path); writes.record(note.path, note.after); }
      return;
    }
    if (options.exampleCleanup || options.requestDeletion) {
      if (!previous || next.integration.ideasFolder !== this.folder || JSON.stringify(previous.projects) !== JSON.stringify(next.projects))
        throw new Error('Cleanup cannot change project notes or vault folders. Refresh the preview.');
      const removed = previous.ideas.filter(idea => !next.ideas.some(item => item.id === idea.id)).map(idea => idea.id);
      const notes = (options.requestDeletion ?? options.exampleCleanup)!.notes;
      const reviewed = Object.keys(notes);
      if (removed.length !== reviewed.length || removed.some(id => !reviewed.includes(id)) || next.ideas.some(idea => {
        const before = previous.ideas.find(item => item.id === idea.id);
        return !before || noteValues(before, before.authorId) !== noteValues(idea, idea.authorId);
      })) throw new Error('Cleanup targets changed. Refresh the preview before removing notes.');
      if (options.requestDeletion && (removed.length !== 1 || options.exampleCleanup || options.replaceAll || options.fromNotes?.length || options.fromProjects?.length || options.requestValuesEdit)) throw new Error('Request deletion requires one reviewed target without unrelated note effects.');
      await (options.requestDeletion ? this.deletion : this.cleanup).remove(notes, id => this.file(id), JSON.stringify(this.persisted(next), null, 2));
      for (const id of removed) this.paths.delete(id);
      return;
    }
    if (next.integration.ideasFolder !== this.folder) await this.moveFolder(next.integration.ideasFolder);
    const external = new Set(options.fromNotes ?? []);
    if (options.replaceAll) await this.retireAll(options.replaceProjectId ? previous?.ideas.filter(idea => idea.projectId === options.replaceProjectId).map(idea => idea.id) : undefined);
    const authors = new Map(next.contributors.map(c => [c.id, c.name]));
    const requestUndos: Array<() => Promise<void>> = [];
    for (const idea of next.ideas) {
      if (external.has(idea.id)) continue;
      const author = authors.get(idea.authorId) ?? idea.authorId;
      const before = previous?.ideas.find(i => i.id === idea.id);
      if (before && noteValues(before, authors.get(before.authorId) ?? before.authorId) === noteValues(idea, author) && this.paths.has(idea.id)) continue;
      const undo = await this.writeIdea(idea, author, options.noteWriteInputs?.[idea.id] ?? before ?? this.loadedNotes.get(idea.id), writes, options.requestValuesEdit?.ideaId === idea.id ? options.requestValuesEdit.expectedInputIdentity : undefined);
      if (undo) requestUndos.push(undo);
    }
    for (const idea of previous?.ideas ?? []) {
      if (external.has(idea.id) || next.ideas.some(i => i.id === idea.id)) continue;
      const file = this.file(idea.id);
      if (file) await this.plugin.app.fileManager.trashFile(file);
      this.paths.delete(idea.id);
    }
    let rollback = async () => {};
    try {
      rollback = await this.projects.save(next.projects);
      await this.plugin.app.vault.adapter.write(this.dataPath, JSON.stringify(this.persisted(next), null, 2));
    } catch (error) {
      await rollback();
      for (const undo of requestUndos.reverse()) await undo();
      throw error;
    }
  }

  /** Reports edits, deletions and renames of idea notes made in the vault. */
  watch(onChange: (change: ExternalNoteChange) => void, onInvalid: (path: string) => void): void {
    const { vault, metadataCache } = this.plugin.app;
    this.plugin.registerEvent(metadataCache.on('changed', file => {
      if (this.writing(file.path) || !vault.getFileByPath(file.path)) return;
      if (!inFolder(file.path, this.folder)) return;
      const path = file.path;
      this.noteWrites.observe(path, async () => { const current = vault.getFileByPath(path); return current ? vault.read(current) : undefined; }, data => {
        let idea: NoteIdea | null;
        try { idea = readIdeaNote(data); } catch { onInvalid(path); return; }
        if (!idea) return;
        const known = this.paths.get(idea.id);
        if (known && known !== path && this.plugin.app.vault.getFileByPath(known)) { onInvalid(path); return; }
        this.paths.set(idea.id, path);
        onChange({ kind: 'upsert', idea });
      }, () => onInvalid(path));
    }));
    this.plugin.registerEvent(vault.on('delete', file => {
      if (this.writing(file.path)) return;
      this.noteWrites.forget(file.path);
      for (const [id, path] of this.paths) if (path === file.path) { this.paths.delete(id); onChange({ kind: 'remove', id }); }
    }));
    this.plugin.registerEvent(vault.on('rename', (file, oldPath) => {
      if (this.writing(file.path) || this.writing(oldPath)) return;
      this.noteWrites.forget(oldPath);
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
      ...omit(state, 'ideas', 'runtime', 'projects'),
      votes: Object.fromEntries(ideas.filter(i => i.voters.length).map(i => [i.id, i.voters])),
      increments: Object.fromEntries(ideas.flatMap(i => i.increment ? [[i.id, i.increment] as const] : [])),
    };
  }

  private async writeIdea(idea: Idea, author: string, before: NoteIdea | undefined, writes: NoteWriteCommit, expectedInputIdentity?: string): Promise<(() => Promise<void>) | undefined> {
    const file = this.file(idea.id);
    if (expectedInputIdentity !== undefined) {
      if (!file) throw new Error('The canonical request note is missing. Refresh before saving its fields.');
      return writeRequestValuesNote(this.plugin, file, idea, author, expectedInputIdentity, readIdeaNote, before, bytes => writes.record(file.path, bytes));
    }
    if (file) {
      await this.plugin.app.vault.process(file, current => {
        assertIdeaWriteIdentity(readIdeaNote(current), before);
        const managed = writeManagedIdeaProperties(current, idea, author);
        if (!idea.contexts?.length) { writes.record(file.path, managed); return managed; }
        const { body } = splitNote(managed);
        const after = managed.slice(0, managed.length - body.length) + appendContextBody(body, idea.contexts);
        writes.record(file.path, after); return after;
      }); return;
    }
    await this.ensureFolder(this.folder);
    let path = normalizePath(`${this.folder}/${ideaFileName(idea)}`);
    for (let n = 2; this.plugin.app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${this.folder}/${ideaFileName(idea).replace(/\.md$/, ` ${n}.md`)}`);
    const bytes = `---\n${stringifyYaml(ideaProperties(idea, author))}---\n${appendContextBody(ideaBody(idea), idea.contexts ?? [])}`;
    const created = await this.plugin.app.vault.create(path, bytes); writes.record(path, bytes);
    this.paths.set(idea.id, created.path);
  }

  /** Moves every known idea note to the vault trash (reversible). */
  private async retireAll(ids?: readonly string[]): Promise<void> {
    for (const id of ids ?? this.paths.keys()) {
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
    if (!this.plugin.app.vault.getAbstractFileByPath(path) && !(await this.plugin.app.vault.adapter.exists(path))) await this.plugin.app.vault.createFolder(path);
  }
}
