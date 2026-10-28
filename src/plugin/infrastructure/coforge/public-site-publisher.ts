import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { FileSystemAdapter, normalizePath, type Plugin } from 'obsidian';
import { pagesWorkflow, WORKFLOW_MARKER, WORKFLOW_PATH } from '../../features/coforge/domain/pages-workflow';
import { buildPublicBoard } from '../../features/coforge/domain/public-board';
import { renderPublicSite } from '../../features/coforge/domain/public-site';
import { PUBLIC_SITE_CSS } from '../../features/coforge/domain/public-site-styles';
import type { AppState } from '../../features/coforge/domain/types';
import { captureProcess } from './process';
import { DEFAULT_IDEAS_FOLDER, validateFolderLayout, type VaultFolderLayout } from '../../features/coforge/domain/vault-folder-policy';
import { protectPrivateData } from './private-data-guard';

export interface PublishResult { folder: string; changed: boolean }
export interface WorkflowResult { workflow: string; folder: string; created: boolean }

/** The generation time from a previously written board.json, so an unchanged board keeps its bytes. */
function previousTime(text: string | null): string | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && 'generatedAt' in value && typeof value.generatedAt === 'string' ? value.generatedAt : null;
  } catch { return null; }
}

/**
 * Writes the public viewer board (index.html, styles.css, board.json) into a vault folder.
 * Files are rewritten only when the public content changed, so commits stay meaningful.
 * Nothing is committed or pushed: the streamer publishes by pushing the vault repository.
 */
export class PublicSitePublisher {
  constructor(private readonly plugin: Plugin, private readonly currentFolders?: () => VaultFolderLayout) {}

  private async layout(folder: string): Promise<VaultFolderLayout> {
    const layout = validateFolderLayout({ ideasFolder: this.currentFolders?.().ideasFolder ?? DEFAULT_IDEAS_FOLDER, publicFolder: folder }, [this.plugin.app.vault.configDir]);
    await protectPrivateData(this.plugin, layout);
    return layout;
  }

  async publish(state: AppState, folder: string): Promise<PublishResult> {
    const target = (await this.layout(folder)).publicFolder;
    const adapter = this.plugin.app.vault.adapter;
    const read = async (name: string) => await adapter.exists(`${target}/${name}`) ? adapter.read(`${target}/${name}`) : null;
    const board = buildPublicBoard(state);
    const existing = await read('board.json');
    const before = previousTime(existing);
    const unchanged = before !== null && JSON.stringify({ ...board, generatedAt: before }, null, 2) === existing;
    const final = unchanged && before ? { ...board, generatedAt: before } : board;
    const files: Array<[string, string]> = [
      ['board.json', JSON.stringify(final, null, 2)], ['index.html', renderPublicSite(final)], ['styles.css', PUBLIC_SITE_CSS], ['.nojekyll', ''],
    ];
    if (!this.plugin.app.vault.getAbstractFileByPath(target) && !(await adapter.exists(target))) await this.plugin.app.vault.createFolder(target);
    let changed = false;
    for (const [name, content] of files) {
      if ((await read(name)) === content) continue;
      await adapter.write(`${target}/${name}`, content);
      changed = true;
    }
    return { folder: target, changed };
  }

  /** Writes the GitHub Pages workflow at the root of the Git repository that contains the vault. */
  async installWorkflow(folder: string): Promise<WorkflowResult> {
    folder = (await this.layout(folder)).publicFolder;
    const adapter = this.plugin.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error('The viewer website setup needs the desktop app with a vault on disk.');
    const vaultPath = adapter.getBasePath();
    let root: string;
    try { root = resolve((await captureProcess('git', ['rev-parse', '--show-toplevel'], { cwd: vaultPath, timeoutMs: 15_000, maxBytes: 8000 })).trim()); }
    catch { throw new Error('This vault is not inside a Git repository. Initialize Git for the vault and add a GitHub remote first.'); }
    const board = relative(root, resolve(vaultPath, normalizePath(folder)));
    if (!board || board.startsWith('..') || isAbsolute(board)) throw new Error('The public board folder must be inside the vault repository.');
    const workflow = join(root, WORKFLOW_PATH);
    const content = pagesWorkflow(board.split('\\').join('/'));
    let existing: string | null = null;
    try { existing = await readFile(workflow, 'utf8'); } catch { existing = null; }
    if (existing !== null && !existing.startsWith(WORKFLOW_MARKER))
      throw new Error(`${WORKFLOW_PATH} already exists and was not created by CoForge. It was left unchanged.`);
    if (existing !== content) {
      await mkdir(dirname(workflow), { recursive: true });
      await writeFile(workflow, content, 'utf8');
    }
    return { workflow, folder: board.split('\\').join('/'), created: existing === null };
  }
}
