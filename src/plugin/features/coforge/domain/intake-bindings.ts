import { boolean, number, oneOf, shape, text } from "./check";
import {
  normalizeVaultFolder,
  vaultFoldersOverlap,
} from "./vault-folder-policy";

export interface IntakeTarget {
  kind: "agent" | "council" | "workflow" | "team";
  id: string;
}
export interface IntakeBinding {
  id: string;
  path: string;
  projectId: string;
  teamId: string;
  target: IntakeTarget;
  enabled: boolean;
  recursive: boolean;
  submit: "after-stable" | "ready";
  settleMs: number;
}
export interface IntakeCandidate {
  path: string;
  sourceId?: string;
  generation: number;
  /** Captured human Markdown only; host excludes generated contribution blocks and metadata. */
  body: string;
  hasHumanContent?: boolean;
  sourceRevision: string;
  draft: boolean;
  ready: boolean;
  error?: string;
}
export interface IntakeFolderPolicy {
  publicFolder: string;
  configFolder: string;
  definitionFolders: readonly string[];
  outputFolders: readonly string[];
}
const identity = text({
  min: 1,
  max: 200,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u,
});
export const intakeBindingCheck = shape(
  {
    id: identity,
    path: (value) => normalizeVaultFolder(value),
    projectId: identity,
    teamId: identity,
    target: shape(
      { kind: oneOf(["agent", "council", "workflow", "team"]), id: identity },
      { strict: true },
    ),
    enabled: boolean,
    recursive: boolean,
    submit: oneOf(["after-stable", "ready"]),
    settleMs: number({ integer: true, min: 0, max: 60000 }),
  },
  { strict: true },
);
function comparable(path: string): string {
  return normalizeVaultFolder(path)
    .toLowerCase()
    .replace(/[. ]+(?=\/|$)/gu, "");
}
export function validateIntakeBindings(
  values: readonly IntakeBinding[],
  policy: IntakeFolderPolicy,
): IntakeBinding[] {
  const bindings = values.map((value) => intakeBindingCheck(value));
  if (new Set(bindings.map((value) => value.id)).size !== bindings.length)
    throw new Error("Inbox IDs must be unique.");
  const forbidden = [
    policy.publicFolder,
    "CoForge/Public",
    policy.configFolder,
    ".git",
    ...policy.definitionFolders,
    ...policy.outputFolders,
  ];
  for (const [index, binding] of bindings.entries()) {
    if (forbidden.some((path) => vaultFoldersOverlap(binding.path, path)))
      throw new Error(
        "Inbox overlaps a public, configuration, definition or output folder.",
      );
    if (
      bindings
        .slice(0, index)
        .some((other) => vaultFoldersOverlap(binding.path, other.path))
    )
      throw new Error(
        "Inbox scopes overlap; choose one unambiguous destination.",
      );
  }
  return bindings;
}
export function routeIntake(
  bindings: readonly IntakeBinding[],
  path: string,
): IntakeBinding | null {
  const normalized = comparable(path);
  if (!normalized.endsWith(".md")) return null;
  const matches = bindings.filter((binding) => {
    if (!binding.enabled) return false;
    const folder = comparable(binding.path);
    if (!normalized.startsWith(`${folder}/`)) return false;
    return (
      binding.recursive || !normalized.slice(folder.length + 1).includes("/")
    );
  });
  if (matches.length > 1)
    throw new Error("Ambiguous inbox routing; resolve overlapping bindings.");
  return matches[0] ?? null;
}
export function intakeSubmissionKey(
  bindingId: string,
  sourceId: string,
  generation: number,
): string {
  identity(bindingId);
  identity(sourceId);
  number({ min: 0, integer: true, max: Number.MAX_SAFE_INTEGER })(generation);
  return JSON.stringify([bindingId, sourceId, generation]);
}
