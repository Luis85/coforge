import { CouncilDefinitionIndex } from "./council-definition-index";
import type { Plugin } from "obsidian";
import type {
  CouncilCatalogueSnapshot,
  CouncilCatalogueStorage,
  CouncilFolderPreview,
} from "../../features/coforge/application/council-catalogue";
import {
  councilDocumentCheck,
  definitionRevision,
  type CouncilDefinitionDocument,
} from "../../features/coforge/domain/council-definitions";
import {
  normalizeVaultFolder,
  vaultFoldersOverlap,
} from "../../features/coforge/domain/vault-folder-policy";
import {
  councilDefinitionFoldersCheck,
  type CouncilDefinitionFolders,
} from "../../features/coforge/domain/council-definition-folders";
export {
  DEFAULT_COUNCIL_FOLDERS,
  type CouncilDefinitionFolders,
} from "../../features/coforge/domain/council-definition-folders";
import {
  indexCouncilDefinitions,
  readCouncilDefinitionNote,
  writeCouncilDefinitionNote,
} from "./council-definition-notes";

/** Host adapter follows stable IDs through filename changes and checks the current note inside vault.process. */
export class VaultCouncilDefinitions implements CouncilCatalogueStorage {
  private readonly knownPaths = new Set<string>();
  private readonly index: CouncilDefinitionIndex;
  constructor(
    private readonly plugin: Plugin,
    private readonly folderSource:
      CouncilDefinitionFolders | (() => CouncilDefinitionFolders),
    private readonly protect: (paths: string[]) => Promise<void>,
    private readonly publicFolder: () => string = () => "CoForge/Public",
  ) {
    this.index = new CouncilDefinitionIndex(plugin, (path) =>
      this.privateLocation(path),
    );
  }
  private get folders(): CouncilDefinitionFolders {
    return councilDefinitionFoldersCheck(
      typeof this.folderSource === "function"
        ? this.folderSource()
        : this.folderSource,
      this.publicFolder(),
      this.plugin.app.vault.configDir,
    );
  }
  private privateLocation(path: string): boolean {
    return ![
      this.publicFolder(),
      "CoForge/Public",
      this.plugin.app.vault.configDir,
      ".git",
    ].some((folder) => vaultFoldersOverlap(path, folder));
  }
  private async scanFolders(
    value: CouncilDefinitionFolders,
  ): Promise<CouncilCatalogueSnapshot> {
    const checked = councilDefinitionFoldersCheck(
      value,
      this.publicFolder(),
      this.plugin.app.vault.configDir,
    );
    const { notes, invalid } = await this.index.read(
      Object.values(checked),
      this.knownPaths,
    );
    for (const note of notes) this.knownPaths.add(note.path);
    const indexed = indexCouncilDefinitions(notes);
    indexed.invalid.push(...invalid);
    return indexed;
  }
  invalidate(
    path: string,
    oldPath?: string,
    folder = false,
    metadataOnly = false,
  ): void {
    this.index.invalidate(path, oldPath, folder, metadataOnly);
    if (oldPath) {
      const previousPaths = [...this.knownPaths];
      for (const known of previousPaths)
        if (known === oldPath || (folder && known.startsWith(oldPath + "/"))) {
          this.knownPaths.delete(known);
          this.knownPaths.add(path + known.slice(oldPath.length));
        }
    }
  }
  scan(): Promise<CouncilCatalogueSnapshot> {
    return this.scanFolders(this.folders);
  }
  privateFolders(): string[] {
    return [
      ...new Set([
        ...Object.values(this.folders),
        ...[...this.knownPaths]
          .map((path) => path.split("/").slice(0, -1).join("/"))
          .filter(Boolean),
      ]),
    ];
  }
  async previewFolders(
    value: CouncilDefinitionFolders,
  ): Promise<CouncilFolderPreview> {
    const folders = councilDefinitionFoldersCheck(
      value,
      this.publicFolder(),
      this.plugin.app.vault.configDir,
    );
    const snapshot = await this.scanFolders(folders);
    return {
      folders,
      definitionCount: snapshot.valid.length,
      invalid: snapshot.invalid,
    };
  }
  async save(
    value: CouncilDefinitionDocument,
    expectedRevision?: string,
  ): Promise<void> {
    const definition = councilDocumentCheck(value);
    const { vault } = this.plugin.app;
    await this.protect(Object.values(this.folders));
    const snapshot = await this.scan();
    const entry = snapshot.valid.find(
      (item) => item.definition.id === definition.id,
    );
    if (entry) {
      const parent = normalizeVaultFolder(entry.path)
        .split("/")
        .slice(0, -1)
        .join("/");
      if (!parent)
        throw new Error(
          "Move the definition into a private folder before editing it.",
        );
      await this.protect([parent]);
      const file = vault.getFileByPath(entry.path);
      if (!file)
        throw new Error("Definition moved during save. Refresh and try again.");
      await vault.process(file, (current) => {
        const previous = readCouncilDefinitionNote(current);
        if (
          previous.id !== definition.id ||
          expectedRevision === undefined ||
          definitionRevision(previous) !== expectedRevision
        )
          throw new Error(
            "Definition changed externally. Refresh; your draft is preserved.",
          );
        return writeCouncilDefinitionNote(current, definition);
      });
      this.invalidate(entry.path);
      return;
    }
    if (expectedRevision !== undefined)
      throw new Error(
        "The canonical definition is unavailable. Repair its note before saving.",
      );
    const folder =
      definition.schema === "agent/v1"
        ? this.folders.agents
        : definition.schema === "team/v1"
          ? this.folders.teams
          : this.folders.councils;
    const path = `${folder}/${definition.id}.md`;
    if (vault.getAbstractFileByPath(path))
      throw new Error(
        "The definition filename is occupied. Choose another identity or repair the existing note.",
      );
    const segments = folder.split("/");
    for (let index = 1; index <= segments.length; index++) {
      const parent = segments.slice(0, index).join("/");
      if (!vault.getAbstractFileByPath(parent))
        await vault.createFolder(parent);
    }
    await vault.create(path, writeCouncilDefinitionNote("", definition));
    this.invalidate(path);
  }
  async open(id: string): Promise<void> {
    const entry = (await this.scan()).valid.find(
      (item) => item.definition.id === id,
    );
    if (!entry)
      throw new Error(
        "Definition unavailable. Refresh and repair invalid notes.",
      );
    await this.plugin.app.workspace.openLinkText(entry.path, "", false);
  }
}
