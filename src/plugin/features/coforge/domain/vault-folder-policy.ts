import { text } from "./check";

export interface VaultFolderLayout {
  ideasFolder: string;
  publicFolder: string;
}
export const DEFAULT_IDEAS_FOLDER = "CoForge/Ideas";
export const DEFAULT_PUBLIC_FOLDER = "CoForge/Public";
const PRIVATE_FOLDERS = [
  DEFAULT_IDEAS_FOLDER,
  "CoForge/Projects",
  "CoForge/Viewers",
  "CoForge/Finance",
  "CoForge/AI-Costs",
  "CoForge/Music",
  "CoForge/Streams",
  "CoForge/Schedule",
  "CoForge/Agents",
  "CoForge/Teams",
  "CoForge/Councils",
  "CoForge/Inboxes",
  "CoForge/Messages",
  "CoForge/Tests",
  ".git",
];
const folderText = text({ trim: true, min: 1, max: 200 });
/** Vault-relative paths only. Canonical segments make platform separator aliases equivalent. */
export function normalizeVaultFolder(value: unknown): string {
  const input = folderText(value);
  if (/^[\\/]/u.test(input) || /[:*?"<>|\p{Cc}]/u.test(input))
    throw new Error(
      "Use a vault-relative folder without control characters or reserved path characters.",
    );
  const segments = input
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => /^\.\.[. ]*$/u.test(segment)))
    throw new Error("Vault folders cannot traverse their parent directories.");
  return segments.join("/") || ".";
}
function key(path: string): string[] {
  return normalizeVaultFolder(path)
    .split("/")
    .map((segment) => segment.replace(/[. ]+$/u, "").toLowerCase())
    .filter(Boolean);
}
export function vaultFoldersOverlap(left: string, right: string): boolean {
  const a = key(left);
  const b = key(right);
  return a
    .slice(0, Math.min(a.length, b.length))
    .every((segment, index) => segment === b[index]);
}
/** The default public subtree remains reserved because its Git whitelist persists across configuration changes. */
export function validateFolderLayout(
  value: VaultFolderLayout,
  additionalPrivateFolders: readonly string[] = [],
): VaultFolderLayout {
  const layout = {
    ideasFolder: normalizeVaultFolder(value.ideasFolder),
    publicFolder: normalizeVaultFolder(value.publicFolder),
  };
  const privateFolders = [
    layout.ideasFolder,
    ...PRIVATE_FOLDERS,
    ...additionalPrivateFolders,
  ];
  for (const publicFolder of [layout.publicFolder, DEFAULT_PUBLIC_FOLDER])
    if (
      privateFolders.some((privateFolder) =>
        vaultFoldersOverlap(privateFolder, publicFolder),
      )
    )
      throw new Error(
        "Keep private CoForge data folders separate from public export folders; neither may contain the other.",
      );
  return layout;
}
