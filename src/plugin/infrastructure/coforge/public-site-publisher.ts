import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { FileSystemAdapter, normalizePath, type Plugin } from "obsidian";
import {
  pagesWorkflow,
  WORKFLOW_MARKER,
  WORKFLOW_PATH,
} from "../../features/coforge/domain/pages-workflow";
import { buildPublicBoard } from "../../features/coforge/domain/public-board";
import { renderPublicSite } from "../../features/coforge/domain/public-site";
import { PUBLIC_SITE_CSS } from "../../features/coforge/domain/public-site-styles";
import type { AppState } from "../../features/coforge/domain/types";
import { captureProcess } from "./process";
import {
  DEFAULT_IDEAS_FOLDER,
  validateFolderLayout,
  type VaultFolderLayout,
} from "../../features/coforge/domain/vault-folder-policy";
import { protectPrivateData } from "./private-data-guard";
import {
  PublicExportOwnership,
  PUBLIC_DATA_FILES,
  type PublicExportReceipt,
} from "./public-export-ownership";
import { projectIsPublic } from "../../features/coforge/domain/project-publicity";
import {
  INITIAL_PROJECT_ID,
  ideaProjectId,
} from "../../features/coforge/domain/projects";
import { DEFAULT_PUBLIC_FOLDER } from "../../features/coforge/domain/vault-folder-policy";

export interface PublishResult {
  folder: string;
  changed: boolean;
}
export interface WorkflowResult {
  workflow: string;
  folder: string;
  created: boolean;
}

/** The generation time from a previously written board.json, so an unchanged board keeps its bytes. */
function previousTime(text: string | null): string | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value &&
      typeof value === "object" &&
      "generatedAt" in value &&
      typeof value.generatedAt === "string"
      ? value.generatedAt
      : null;
  } catch {
    return null;
  }
}

/**
 * Writes the public viewer board (index.html, styles.css, board.json) into a vault folder.
 * Files are rewritten only when the public content changed, so commits stay meaningful.
 * Nothing is committed or pushed: the streamer publishes by pushing the vault repository.
 */
export class PublicSitePublisher {
  private tail: Promise<void> = Promise.resolve();
  private readonly ownership: PublicExportOwnership;
  constructor(
    private readonly plugin: Plugin,
    private readonly currentFolders?: () => VaultFolderLayout,
    private readonly privateFolders: () => readonly string[] = () => [],
    private readonly currentState?: () => AppState,
  ) {
    this.ownership = new PublicExportOwnership(plugin);
  }

  private async acquire(): Promise<() => void> {
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }
  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await work();
    } finally {
      release();
    }
  }
  private publicIds(state: AppState): string[] {
    return [
      ...new Set([
        ...(state.projects?.map((project) => project.id) ?? []),
        ...state.ideas.map(ideaProjectId),
        state.activeProjectId || INITIAL_PROJECT_ID,
      ]),
    ]
      .filter((id) => projectIsPublic(state, id))
      .sort();
  }
  /** The lease covers the visibility commit, not merely the earlier file deletion. */
  async beforeCommit(
    next: AppState,
    previous: AppState | null,
  ): Promise<void | (() => void)> {
    const canonicalNext = { projects: next.projects };
    const revoked =
      previous &&
      (this.publicIds({
        ...previous,
        runtime: { ...previous.runtime, publicationDeniedProjectIds: [] },
      }).some((id) => !projectIsPublic(canonicalNext, id)) ||
        (next.runtime.publicationDeniedProjectIds ?? []).some(
          (id) => !previous.runtime.publicationDeniedProjectIds?.includes(id),
        ));
    if (previous && !revoked) return;
    const release = await this.acquire();
    try {
      await protectPrivateData(this.plugin);
      const receipts = await this.ownership.load();
      const folders = new Set([
        DEFAULT_PUBLIC_FOLDER,
        ...receipts.map((item) => item.folder),
      ]);
      if (previous && this.currentFolders)
        folders.add(this.currentFolders().publicFolder);
      for (const file of this.plugin.app.vault.getFiles())
        if (file.name === "board.json" && file.path.includes("/"))
          folders.add(file.path.slice(0, file.path.lastIndexOf("/")));
      const known = new Set(receipts.map((item) => item.folder));
      const legacy: PublicExportReceipt[] = [];
      for (const folder of folders)
        if (!known.has(folder)) {
          const receipt = await this.ownership.legacy(folder);
          if (receipt) {
            receipt.publicProjectIds = [
              ...new Set([
                ...receipt.publicProjectIds,
                ...this.publicIds(next),
              ]),
            ];
            receipts.push(receipt);
            legacy.push(receipt);
          }
        }
      const privateNow = [
        ...new Set([
          ...(next.projects?.map((project) => project.id) ?? []),
          ...next.ideas.map(ideaProjectId),
        ]),
      ].some((id) => !projectIsPublic(next, id));
      const selected = receipts.filter(
        (receipt) =>
          revoked ||
          receipt.publicProjectIds.some((id) => !projectIsPublic(next, id)) ||
          (privateNow && legacy.includes(receipt)),
      );
      for (const receipt of selected) await this.ownership.validate(receipt);
      // Ownership is durable before retirement, including a restart after a partially removed export.
      if (legacy.length) await this.ownership.save(receipts);
      for (const receipt of selected) {
        for (const name of PUBLIC_DATA_FILES)
          if (
            receipt.files[name] &&
            (await this.plugin.app.vault.adapter.exists(
              `${receipt.folder}/${name}`,
            ))
          ) {
            await this.ownership.validate(receipt);
            await this.plugin.app.vault.adapter.remove(
              `${receipt.folder}/${name}`,
            );
          }
        receipt.files = {};
        receipt.publicProjectIds = [];
      }
      if (selected.length) await this.ownership.save(receipts);
      return release;
    } catch (error) {
      release();
      throw error;
    }
  }

  private async layout(folder: string): Promise<VaultFolderLayout> {
    const layout = validateFolderLayout(
      {
        ideasFolder:
          this.currentFolders?.().ideasFolder ?? DEFAULT_IDEAS_FOLDER,
        publicFolder: folder,
      },
      [this.plugin.app.vault.configDir, ...this.privateFolders()],
    );
    await protectPrivateData(this.plugin, layout);
    return layout;
  }

  async publish(state: AppState, folder: string): Promise<PublishResult> {
    return this.serial(() =>
      this.write(this.currentState?.() ?? state, folder),
    );
  }
  /** Both queued data and target selection are evaluated after acquiring the publication lease. */
  publishCurrent(
    state: () => AppState,
    folder: () => string,
    enabled?: () => boolean,
  ): Promise<PublishResult> {
    return this.serial(() =>
      enabled && !enabled()
        ? Promise.resolve({ folder: folder(), changed: false })
        : this.write(this.currentState?.() ?? state(), folder()),
    );
  }
  private async write(state: AppState, folder: string): Promise<PublishResult> {
    const target = (await this.layout(folder)).publicFolder;
    const adapter = this.plugin.app.vault.adapter;
    const read = async (name: string) =>
      (await adapter.exists(`${target}/${name}`))
        ? adapter.read(`${target}/${name}`)
        : null;
    const board = buildPublicBoard(state);
    const existing = await read("board.json");
    const before = previousTime(existing);
    const unchanged =
      before !== null &&
      JSON.stringify({ ...board, generatedAt: before }, null, 2) === existing;
    const final =
      unchanged && before ? { ...board, generatedAt: before } : board;
    const files: Array<[string, string]> = [
      ["board.json", JSON.stringify(final, null, 2)],
      ["index.html", renderPublicSite(final)],
      ["styles.css", PUBLIC_SITE_CSS],
      [".nojekyll", ""],
    ];
    await this.ownership.plan(
      target,
      { "board.json": files[0]![1], "index.html": files[1]![1] },
      this.publicIds(state),
    );
    if (
      !this.plugin.app.vault.getAbstractFileByPath(target) &&
      !(await adapter.exists(target))
    )
      await this.plugin.app.vault.createFolder(target);
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
    return this.serial(() => this.writeWorkflow(folder));
  }
  private async writeWorkflow(folder: string): Promise<WorkflowResult> {
    folder = (await this.layout(folder)).publicFolder;
    const adapter = this.plugin.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter))
      throw new Error(
        "The viewer website setup needs the desktop app with a vault on disk.",
      );
    const vaultPath = adapter.getBasePath();
    let root: string;
    try {
      root = resolve(
        (
          await captureProcess("git", ["rev-parse", "--show-toplevel"], {
            cwd: vaultPath,
            timeoutMs: 15_000,
            maxBytes: 8000,
          })
        ).trim(),
      );
    } catch {
      throw new Error(
        "This vault is not inside a Git repository. Initialize Git for the vault and add a GitHub remote first.",
      );
    }
    const board = relative(root, resolve(vaultPath, normalizePath(folder)));
    if (!board || board.startsWith("..") || isAbsolute(board))
      throw new Error(
        "The public board folder must be inside the vault repository.",
      );
    const workflow = join(root, WORKFLOW_PATH);
    const content = pagesWorkflow(board.split("\\").join("/"));
    let existing: string | null = null;
    try {
      existing = await readFile(workflow, "utf8");
    } catch {
      existing = null;
    }
    if (existing !== null && !existing.startsWith(WORKFLOW_MARKER))
      throw new Error(
        `${WORKFLOW_PATH} already exists and was not created by CoForge. It was left unchanged.`,
      );
    if (existing !== content) {
      await mkdir(dirname(workflow), { recursive: true });
      await writeFile(workflow, content, "utf8");
    }
    return {
      workflow,
      folder: board.split("\\").join("/"),
      created: existing === null,
    };
  }
}
