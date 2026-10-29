import { SCHEDULED_TASK_FOLDER } from "../../features/coforge/domain/scheduled-task";
import type { Plugin } from "obsidian";
import {
  normalizeVaultFolder,
  vaultFoldersOverlap,
} from "../../features/coforge/domain/vault-folder-policy";

/** Protect every configured private subtree before the first definition, submission or transcript write. */
export async function protectCouncilPrivatePaths(
  plugin: Plugin,
  paths: readonly string[],
  publicFolder: string,
): Promise<void> {
  const { vault } = plugin.app;
  for (const value of paths) {
    const path = normalizeVaultFolder(value);
    if (
      [publicFolder, "CoForge/Public", vault.configDir, ".git"].some((folder) =>
        vaultFoldersOverlap(path, folder),
      )
    )
      throw new Error(
        "Keep Council private folders separate from public export and host configuration.",
      );
    const segments = path.split("/");
    for (let index = 1; index <= segments.length; index++) {
      const parent = segments.slice(0, index).join("/");
      if (!vault.getAbstractFileByPath(parent))
        await vault.createFolder(parent);
    }
    const ignore = `${path}/.gitignore`;
    const before = (await vault.adapter.exists(ignore))
      ? await vault.adapter.read(ignore)
      : "";
    const marker = "# CoForge Council private data";
    if (!before.includes(marker))
      await vault.adapter.write(
        ignore,
        `${before}${before && !before.endsWith("\n") ? "\n" : ""}${marker}\n*\n!.gitignore\n`,
      );
  }
  const directory =
    plugin.manifest.dir ?? `${vault.configDir}/plugins/${plugin.manifest.id}`;
  const ignore = `${directory}/.gitignore`;
  const before = (await vault.adapter.exists(ignore))
    ? await vault.adapter.read(ignore)
    : "";
  if (!before.includes("coforge-*.json*"))
    await vault.adapter.write(
      ignore,
      `${before}${before && !before.endsWith("\n") ? "\n" : ""}coforge-*.json*\n`,
    );
}
import type { IntakeBinding } from "../../features/coforge/domain/intake-bindings";
import type { IntakeFolderPolicy } from "../../features/coforge/domain/intake-bindings";
import { COUNCIL_TASK_FOLDER } from "../../features/coforge/domain/council-task";
import {
  DEFAULT_COUNCIL_FOLDERS,
  type CouncilDefinitionFolders,
} from "../../features/coforge/domain/council-definition-folders";
/** All registered private locations participate in later public-folder validation. */
export function councilRegisteredPrivateFolders(
  definitions: readonly string[],
  bindings: readonly IntakeBinding[],
  sources: readonly string[],
): string[] {
  return [
    ...new Set([
      ...definitions,
      ...bindings.map((binding) => binding.path),
      ...sources,
      "CoForge/Messages",
      "CoForge/Tests",
      COUNCIL_TASK_FOLDER,
      SCHEDULED_TASK_FOLDER,
    ]),
  ];
}

export function councilModulePrivateFolders(
  ready: boolean,
  definitions: () => readonly string[],
  configured: CouncilDefinitionFolders | undefined,
  bindings: readonly IntakeBinding[],
  sources: readonly string[],
): string[] {
  return councilRegisteredPrivateFolders(
    ready
      ? definitions()
      : Object.values(configured ?? DEFAULT_COUNCIL_FOLDERS),
    bindings,
    sources,
  );
}

export function councilFolderPolicy(
  plugin: Plugin,
  publicFolder: string,
  definitions: readonly string[],
): IntakeFolderPolicy {
  return {
    publicFolder,
    configFolder: plugin.app.vault.configDir,
    definitionFolders: definitions,
    outputFolders: ["CoForge/Tests", "CoForge/Messages", COUNCIL_TASK_FOLDER, SCHEDULED_TASK_FOLDER],
  };
}
