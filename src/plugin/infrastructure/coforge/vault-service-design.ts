import { parseYaml, stringifyYaml, type Plugin } from 'obsidian';
import {
  blueprintFolder, blueprintId, blueprintRelationshipWarnings, isBlueprintKind, validateBlueprintInput,
  type BlueprintCatalogue, type BlueprintNote, type BlueprintRepository,
} from '../../features/service-design/domain/blueprint';
import { validateFolderLayout, vaultFoldersOverlap, type VaultFolderLayout } from '../../features/coforge/domain/vault-folder-policy';
import { splitNote } from './markdown';

const DEFAULT_ROOT = 'CoForge/Service Design';
const owned = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid frontmatter');
  return Object.fromEntries(Object.entries(value));
};
const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Missing text property');
  return value;
};
const ids = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > 100 || !value.every(item => typeof item === 'string' && blueprintId(item)))
    throw new Error('Invalid entity links');
  return value.map(item => String(item));
};

/** Canonical note storage with exact previous-content guards and retained folder history. */
export class VaultServiceDesign implements BlueprintRepository {
  private folder = DEFAULT_ROOT;
  private roots = [DEFAULT_ROOT];
  private readonly pendingRoots = new Set<string>();
  private readonly known = new Map<string, { note: BlueprintNote; content: string }>();
  constructor(
    private readonly plugin: Plugin,
    private readonly layout: () => VaultFolderLayout,
    private readonly otherPrivateFolders: () => readonly string[],
  ) {}
  private get settingsPath() {
    return `${this.plugin.manifest.dir ?? `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`}/coforge-service-design.json`;
  }
  private validateFolder(value: string): string {
    const folder = blueprintFolder(value);
    const layout = this.layout();
    validateFolderLayout(layout, [...this.otherPrivateFolders(), folder, this.plugin.app.vault.configDir]);
    const reserved = [layout.ideasFolder, 'CoForge/Projects', 'CoForge/Viewers', 'CoForge/Finance',
      'CoForge/AI-Costs', 'CoForge/Music', 'CoForge/Streams', 'CoForge/Schedule',
      'CoForge/Agents', 'CoForge/Teams', 'CoForge/Councils', 'CoForge/Tasks', 'CoForge/CouncilTasks',
      'CoForge/Inboxes', 'CoForge/Messages', 'CoForge/Recovery', 'CoForge/Tests', ...this.otherPrivateFolders()];
    if (reserved.some(path => vaultFoldersOverlap(path, folder)))
      throw new Error('Choose a Service Design folder separate from other managed CoForge folders.');
    return folder;
  }
  async initialize(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    if (!await adapter.exists(this.settingsPath)) return;
    try {
      const settings = owned(JSON.parse(await adapter.read(this.settingsPath)));
      if (settings.schema !== 1 || !Array.isArray(settings.roots) || !settings.roots.length || settings.roots.length > 50)
        throw new Error('Invalid settings');
      const folder = this.validateFolder(text(settings.folder));
      const roots = settings.roots.map(root => this.validateFolder(text(root)));
      if (!roots.includes(folder) || !roots.includes(DEFAULT_ROOT)) throw new Error('Missing retained root');
      this.folder = folder;
      this.roots = [...new Set(roots)];
    } catch { throw new Error('Service Design settings are invalid. Restore coforge-service-design.json before continuing.'); }
  }
  privateFolders(): readonly string[] { return [...new Set([...this.roots, ...this.pendingRoots])]; }
  async load(): Promise<BlueprintCatalogue> {
    await this.initialize();
    const files = this.plugin.app.vault.getMarkdownFiles().filter(file => this.roots.some(root => file.path.startsWith(root + '/')));
    if (files.length > 5000) throw new Error('Service Design exceeds 5,000 notes. Reduce the collection before refreshing.');
    const previous = new Map(this.known);
    const nextKnown = new Map<string, { note: BlueprintNote; content: string }>();
    const notes: BlueprintNote[] = [];
    const warnings: string[] = [];
    const duplicateIds = new Set<string>();
    for (const file of files) {
      const content = await this.plugin.app.vault.read(file);
      const { yaml, body } = splitNote(content);
      if (!yaml) continue;
      try {
        const props = owned(parseYaml(yaml));
        if (props.type !== 'coforge-service-design') continue;
        const id = text(props.id);
        const projectId = text(props.project_id);
        const blueprint = text(props.blueprint_id);
        if (props.schema !== 1 || !blueprintId(id) || !blueprintId(projectId) || !blueprintId(blueprint) || !isBlueprintKind(props.kind) || typeof props.order !== 'number')
          throw new Error('Invalid schema or identity');
        const old = previous.get(id);
        const note: BlueprintNote = {
          id, projectId, blueprintId: blueprint, kind: props.kind, title: text(props.title),
          order: props.order, stepId: text(props.step_id), links: ids(props.link_ids), body,
          path: file.path, version: old?.content === content && old.note.path === file.path ? old.note.version : crypto.randomUUID(),
        };
        validateBlueprintInput(note);
        if (nextKnown.has(id) || duplicateIds.has(id)) {
          duplicateIds.add(id); nextKnown.delete(id);
          throw new Error('Duplicate entity ID');
        }
        nextKnown.set(id, { note, content });
        notes.push(note);
      } catch { warnings.push(`Invalid or duplicate Service Design note: ${file.path}`); }
    }
    const uniqueNotes = notes.filter(note => !duplicateIds.has(note.id));
    warnings.push(...blueprintRelationshipWarnings(uniqueNotes));
    this.known.clear();
    for (const [id, known] of nextKnown) this.known.set(id, known);
    return { folder: this.folder, notes: uniqueNotes, warnings };
  }
  private async ensure(folder: string) {
    let current = '';
    for (const part of folder.split('/')) {
      current += (current ? '/' : '') + part;
      if (!this.plugin.app.vault.getAbstractFileByPath(current)) await this.plugin.app.vault.createFolder(current);
    }
  }
  private async protect(folder: string) {
    await this.ensure(folder);
    const adapter = this.plugin.app.vault.adapter;
    const path = folder + '/.gitignore';
    const current = await adapter.exists(path) ? await adapter.read(path) : '';
    const block = '# CoForge private Service Design\n*\n';
    if (!current.endsWith(block))
      await adapter.write(path, current + (current && !current.endsWith('\n') ? '\n' : '') + block);
  }
  async configure(input: string): Promise<void> {
    await this.initialize();
    const folder = this.validateFolder(input);
    const roots = [...new Set([...this.roots, folder])];
    if (roots.length > 50) throw new Error('Keep at most 50 retained Service Design folders.');
    this.pendingRoots.add(folder);
    try {
      await this.protect(folder);
      const pluginFolder = this.settingsPath.slice(0, this.settingsPath.lastIndexOf('/'));
      let current = '';
      for (const part of pluginFolder.split('/')) {
        current += (current ? '/' : '') + part;
        if (!await this.plugin.app.vault.adapter.exists(current)) await this.plugin.app.vault.adapter.mkdir(current);
      }
      this.validateFolder(folder);
      await this.plugin.app.vault.adapter.write(this.settingsPath, JSON.stringify({ schema: 1, folder, roots }, null, 2));
      this.folder = folder; this.roots = roots;
    } finally {
      this.pendingRoots.delete(folder);
    }
  }
  private properties(note: BlueprintNote) {
    const link = (id: string) => {
      const path = id === note.id ? note.path : this.known.get(id)?.note.path;
      if (!path) throw new Error('A linked note is missing. Refresh before saving.');
      return `[[${path.replace(/\.md$/u, '')}]]`;
    };
    return { type: 'coforge-service-design', schema: 1, id: note.id, kind: note.kind,
      project_id: note.projectId, blueprint_id: note.blueprintId, title: note.title,
      order: note.order, step_id: note.stepId, link_ids: note.links,
      blueprint: link(note.blueprintId), step: note.stepId ? link(note.stepId) : '', related: note.links.map(link) };
  }
  async save(input: BlueprintNote): Promise<BlueprintNote> {
    validateBlueprintInput(input);
    if (![input.id, input.projectId, input.blueprintId].every(blueprintId))
      throw new Error('Invalid Service Design identity. Refresh before saving.');
    const { vault } = this.plugin.app;
    const existing = this.known.get(input.id);
    if (existing && (existing.note.projectId !== input.projectId || existing.note.kind !== input.kind || existing.note.blueprintId !== input.blueprintId))
      throw new Error('An entity cannot change its project, blueprint or type.');
    const path = existing?.note.path ?? `${this.folder}/${input.projectId}/${input.id}.md`;
    const note = { ...input, path };
    const graph = [...this.known.values()].filter(known => known.note.id !== note.id).map(known => known.note);
    if (blueprintRelationshipWarnings([...graph, note]).length)
      throw new Error('Resolve invalid Service Design relationships, then Refresh before saving.');
    const properties = this.properties(note);
    let content: string;
    if (input.version) {
      if (!existing || existing.note.version !== input.version) throw new Error('Refresh and reopen the note before saving.');
      const file = vault.getFileByPath(existing.note.path);
      if (!file) throw new Error('The note is missing. Refresh before saving.');
      content = await vault.process(file, current => {
        if (current !== existing.content) throw new Error('An external edit was detected. Refresh and reopen the note before saving.');
        const { yaml } = splitNote(current);
        return `---\n${stringifyYaml({ ...owned(parseYaml(yaml ?? '')), ...properties })}---\n${note.body}`;
      });
    } else {
      if (existing) throw new Error('This entity already exists. Refresh before saving.');
      this.validateFolder(this.folder);
      await this.protect(this.folder);
      await this.ensure(`${this.folder}/${input.projectId}`);
      content = `---\n${stringifyYaml(properties)}---\n${note.body}`;
      await vault.create(path, content);
    }
    const saved = { ...note, version: crypto.randomUUID() };
    this.known.set(note.id, { note: { ...saved, links: [...saved.links] }, content });
    return { ...saved, links: [...saved.links] };
  }
  async open(id: string): Promise<void> {
    const known = this.known.get(id);
    const file = known ? this.plugin.app.vault.getFileByPath(known.note.path) : null;
    if (!file) throw new Error('This note is missing. Refresh before opening.');
    await this.plugin.app.workspace.getLeaf('tab').openFile(file);
  }
}
