import { record, shape, text } from "./check";
import {
  normalizeVaultFolder,
  vaultFoldersOverlap,
} from "./vault-folder-policy";

export interface CouncilDefinitionFolders {
  agents: string;
  teams: string;
  councils: string;
}
export const DEFAULT_COUNCIL_FOLDERS: CouncilDefinitionFolders = {
  agents: "CoForge/Agents",
  teams: "CoForge/Teams",
  councils: "CoForge/Councils",
};
const folder = text({ min: 1, max: 200 });
export function councilDefinitionFoldersCheck(
  value: unknown,
  publicFolder = "CoForge/Public",
  configFolder?: string,
): CouncilDefinitionFolders {
  record(value);
  const input = shape(
    { agents: folder, teams: folder, councils: folder },
    { strict: true },
  )(value);
  const normalized = {
    agents: normalizeVaultFolder(input.agents),
    teams: normalizeVaultFolder(input.teams),
    councils: normalizeVaultFolder(input.councils),
  };
  const paths = Object.values(normalized);
  const reserved = [
    "CoForge/Public",
    publicFolder,
    ".git",
    ...(configFolder ? [configFolder] : []),
  ];
  if (
    paths.some((path) =>
      reserved.some((target) => vaultFoldersOverlap(path, target)),
    )
  )
    throw new Error(
      "Definition folders must stay private and separate from public exports, Obsidian configuration and Git metadata.",
    );
  if (
    paths.some((path, index) =>
      paths.slice(index + 1).some((other) => vaultFoldersOverlap(path, other)),
    )
  )
    throw new Error(
      "Agent, team and council definition folders must have separate non-overlapping scopes.",
    );
  return normalized;
}
