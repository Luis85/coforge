import { normalizePath, parseYaml, stringifyYaml, type Plugin, type TFile } from 'obsidian';
import { applyProjectProperties, parseProjectNote, projectBody, projectProperties, PROJECT_PROPERTIES } from '../../features/coforge/domain/project-note';
import { PROJECTS_FOLDER } from '../../features/coforge/domain/projects';
import type { StudioProject } from '../../features/coforge/domain/types';
import { splitNote } from './markdown';
import { record } from '../../features/coforge/domain/check';

export type ProjectNoteChange = { kind: 'upsert'; project: StudioProject } | { kind: 'remove'; id: string };
const inFolder = (path: string) => path.startsWith(`${PROJECTS_FOLDER}/`);
const fingerprint = (project: StudioProject) => JSON.stringify(projectProperties(project));
export function readProjectNote(content: string): StudioProject | null {
  const { yaml } = splitNote(content);
  return yaml === null ? null : parseProjectNote(parseYaml(yaml));
}

/** Canonical project frontmatter. Never rewrites an existing Markdown body or unrelated properties. */
export class VaultProjects {
  private readonly paths = new Map<string, string>();
  private readonly written = new Map<string, string>();
  private readonly writing = new Set<string>();
  constructor(private readonly plugin: Plugin) {}

  file(id: string): TFile | null {
    const path = this.paths.get(id);
    return path ? this.plugin.app.vault.getFileByPath(path) : null;
  }
  async load(): Promise<{ projects: StudioProject[]; invalid: string[] }> {
    this.paths.clear(); this.written.clear();
    const projects: StudioProject[] = []; const invalid: string[] = [];
    for (const file of this.plugin.app.vault.getMarkdownFiles().filter(file => inFolder(file.path))) {
      let project: StudioProject | null;
      try { project = readProjectNote(await this.plugin.app.vault.cachedRead(file)); }
      catch { invalid.push(file.path); continue; }
      if (!project) continue;
      if (this.paths.has(project.id)) throw new Error('Two project notes use the same project ID. Restore unique project IDs before opening CoForge.');
      this.paths.set(project.id, file.path); this.written.set(project.id, fingerprint(project)); projects.push(project);
    }
    return { projects, invalid };
  }

  /** Returns a rollback for project-owned changes if a subsequent storage operation fails. */
  async save(projects: readonly StudioProject[]): Promise<() => Promise<void>> {
    const undos: Array<() => Promise<void>> = [];
    const rollback = async () => { for (const undo of [...undos].reverse()) await undo(); };
    try {
      for (const project of projects) {
        if (project.unavailable || (this.file(project.id) && this.written.get(project.id) === fingerprint(project))) continue;
        const file = this.file(project.id);
        if (file) {
          const before = record(parseYaml(splitNote(await this.plugin.app.vault.read(file)).yaml ?? ''));
          const oldFingerprint = this.written.get(project.id);
          await this.write(file.path, async () => {
            await this.plugin.app.fileManager.processFrontMatter(file, properties => applyProjectProperties(record(properties), project));
            this.written.set(project.id, fingerprint(project));
          });
          undos.push(() => this.write(file.path, async () => {
            if (!(await this.matches(file, project))) return;
            await this.plugin.app.fileManager.processFrontMatter(file, properties => {
              for (const key of PROJECT_PROPERTIES) { if (key in before) properties[key] = before[key]; else delete properties[key]; }
            });
            if (oldFingerprint) this.written.set(project.id, oldFingerprint); else this.written.delete(project.id);
          }));
        } else {
          if (!this.plugin.app.vault.getAbstractFileByPath(PROJECTS_FOLDER)) await this.plugin.app.vault.createFolder(PROJECTS_FOLDER);
          const name = project.settings.projectName.replace(/[\\/:*?"<>|#^[\]]/g, ' ').trim().slice(0, 70) || 'Project';
          let path = normalizePath(`${PROJECTS_FOLDER}/${project.id} ${name}.md`);
          for (let index = 2; this.plugin.app.vault.getAbstractFileByPath(path); index++) path = normalizePath(`${PROJECTS_FOLDER}/${project.id} ${name} ${index}.md`);
          await this.write(path, async () => {
            await this.plugin.app.vault.create(path, `---\n${stringifyYaml(projectProperties(project))}---\n${projectBody(project)}`);
            this.paths.set(project.id, path); this.written.set(project.id, fingerprint(project));
          });
          undos.push(() => this.write(path, async () => {
            const created = this.file(project.id);
            if (created && (!(await this.matches(created, project)) || splitNote(await this.plugin.app.vault.read(created)).body !== projectBody(project))) return;
            if (created) await this.plugin.app.fileManager.trashFile(created);
            this.paths.delete(project.id); this.written.delete(project.id);
          }));
        }
      }
    } catch (error) { await rollback(); throw error; }
    return rollback;
  }

  watch(onChange: (change: ProjectNoteChange) => void, onInvalid: (path: string) => void): void {
    const { vault, metadataCache } = this.plugin.app;
    const invalid = (path: string) => {
      for (const [id, known] of this.paths) if (path === known) { this.written.delete(id); onChange({ kind: 'remove', id }); }
      onInvalid(path);
    };
    this.plugin.registerEvent(metadataCache.on('changed', (file, content) => {
      if (!inFolder(file.path) || this.writing.has(file.path) || !vault.getFileByPath(file.path)) return;
      let project: StudioProject | null;
      try { project = readProjectNote(content); } catch { invalid(file.path); return; }
      if (!project) { if ([...this.paths.values()].includes(file.path)) invalid(file.path); return; }
      const known = this.paths.get(project.id);
      if (known && known !== file.path && vault.getFileByPath(known)) { onInvalid(file.path); return; }
      for (const [oldId, oldPath] of this.paths) if (oldPath === file.path && oldId !== project.id) {
        this.paths.delete(oldId); this.written.delete(oldId); onChange({ kind: 'remove', id: oldId });
      }
      this.paths.set(project.id, file.path);
      if (this.written.get(project.id) === fingerprint(project)) return;
      this.written.set(project.id, fingerprint(project)); onChange({ kind: 'upsert', project });
    }));
    this.plugin.registerEvent(vault.on('delete', file => {
      if (this.writing.has(file.path)) return;
      for (const [id, path] of this.paths) if (path === file.path || path.startsWith(`${file.path}/`)) {
        this.paths.delete(id); this.written.delete(id); onChange({ kind: 'remove', id });
      }
    }));
    this.plugin.registerEvent(vault.on('rename', (file, oldPath) => {
      for (const [id, path] of this.paths) {
        if (path !== oldPath && !path.startsWith(`${oldPath}/`)) continue;
        const next = file.path + path.slice(oldPath.length);
        if (inFolder(next)) this.paths.set(id, next);
        else { this.paths.delete(id); this.written.delete(id); onChange({ kind: 'remove', id }); }
      }
    }));
  }

  private async write(path: string, work: () => Promise<void>): Promise<void> {
    this.writing.add(path);
    try { await work(); } finally { this.writing.delete(path); }
  }
  private async matches(file: TFile, project: StudioProject): Promise<boolean> {
    try {
      const current = readProjectNote(await this.plugin.app.vault.read(file));
      return current !== null && fingerprint(current) === fingerprint(project);
    } catch { return false; }
  }
}
