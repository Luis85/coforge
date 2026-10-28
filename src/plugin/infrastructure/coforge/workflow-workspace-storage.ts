import type { Plugin } from "obsidian";
import type {
  WorkflowWorkspaceRecord,
  WorkflowWorkspaceStorage,
} from "../../features/coforge/application/workflow-workspace-ports";
import {
  list,
  number,
  oneOf,
  optional,
  shape,
  text,
} from "../../features/coforge/domain/check";
const identity = text({ min: 1, max: 320 });
const path = text({ min: 1, max: 4096 });
const recordsCheck = list(
  shape(
    {
      id: identity,
      runId: identity,
      projectId: identity,
      projectPath: path,
      cwd: path,
      branch: identity,
      baseCommit: text({ min: 40, max: 64, pattern: /^[a-f0-9]+$/u }),
      phase: oneOf(["reserved", "ready", "attention", "retired"] as const),
      pointer: optional(text({ min: 1, max: 4096 })),
      directoryDevice: optional(number({ min: 0 })),
      directoryInode: optional(number({ min: 0 })),
      activeAttemptId: optional(identity),
      reviewedAttemptId: optional(identity),
      lastAttemptId: optional(identity),
    },
    { strict: true },
  ),
  { max: 1000 },
);
function validate(value: unknown): WorkflowWorkspaceRecord[] {
  const records = recordsCheck(value);
  if (
    new Set(records.map((record) => record.id)).size !== records.length ||
    new Set(records.map((record) => record.runId)).size !== records.length ||
    records.some(
      (record) =>
        record.phase === "ready" &&
        (!record.pointer ||
          record.directoryDevice === undefined ||
          record.directoryInode === undefined),
    ) ||
    records.some(
      (record) => record.phase === "retired" && record.activeAttemptId,
    )
  )
    throw new Error("inconsistent");
  return records;
}
/** Private metadata only; unreadable journals fail closed instead of discarding holds. */
export class WorkflowWorkspaceStateStorage implements WorkflowWorkspaceStorage {
  constructor(private readonly plugin: Plugin) {}
  private get path(): string {
    const { app, manifest } = this.plugin;
    return `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-workspaces.json`;
  }
  async load(): Promise<WorkflowWorkspaceRecord[]> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      if (!(await adapter.exists(this.path))) return [];
      const info = await adapter.stat(this.path);
      if (!info || info.type !== "file" || info.size > 8 * 1024 * 1024)
        throw new Error("limit");
      const raw = await adapter.read(this.path);
      if (Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error("limit");
      return validate(JSON.parse(raw));
    } catch {
      throw new Error(
        "The private workflow workspace journal could not be loaded. Restore it before running agents.",
      );
    }
  }
  async save(records: WorkflowWorkspaceRecord[]): Promise<void> {
    try {
      const raw = JSON.stringify(validate(records), null, 2);
      if (Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error("limit");
      await this.plugin.app.vault.adapter.write(this.path, raw);
    } catch {
      throw new Error(
        "The private workflow workspace journal could not be saved. No further workspace operations are allowed.",
      );
    }
  }
}
