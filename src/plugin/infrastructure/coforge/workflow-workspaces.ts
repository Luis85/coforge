import { lstat, mkdir, mkdtemp, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type {
  WorkflowWorkspaceLease,
  WorkflowWorkspaceRecord,
  WorkflowWorkspaceRequest,
  WorkflowWorkspaceStorage,
  WorkflowWorkspaces,
} from "../../features/coforge/application/workflow-workspace-ports";
import { agentGit, captureIncrement, projectRoot } from "./agent-worktree";

const attention = () =>
  new Error(
    "The workflow workspace needs attention. Inspect its original attempt before continuing; no worktree was replayed.",
  );
/** Durable run-scoped native workspace; it owns no external agent process and never deletes recovery evidence. */
export class LocalWorkflowWorkspaces implements WorkflowWorkspaces {
  private records: WorkflowWorkspaceRecord[] = [];
  private ready = false;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly storage: WorkflowWorkspaceStorage,
    private readonly temporaryRoot = tmpdir(),
    private readonly idPrefix = '',
  ) {}
  private command<T>(work: () => Promise<T>): Promise<T> {
    const next = this.pending.then(work);
    this.pending = next.catch(() => undefined);
    return next;
  }
  private async save(records = this.records): Promise<void> {
    try {
      await this.storage.save(structuredClone(records));
      this.records = records;
    } catch {
      this.ready = false;
      throw attention();
    }
  }
  start(): Promise<void> {
    return this.command(async () => {
      this.ready = false;
      const records = await this.storage.load();
      if (
        new Set(records.map((record) => record.id)).size !== records.length ||
        new Set(records.map((record) => record.runId)).size !== records.length
      )
        throw attention();
      const recovered = records.map((record) =>
        record.phase === "reserved" || record.activeAttemptId
          ? { ...record, phase: "attention" as const }
          : record,
      );
      if (JSON.stringify(recovered) !== JSON.stringify(records))
        await this.save(recovered);
      else this.records = recovered;
      this.ready = true;
    });
  }
  private async verify(record: WorkflowWorkspaceRecord): Promise<void> {
    if (
      record.phase !== "ready" ||
      !record.pointer ||
      record.directoryDevice === undefined ||
      record.directoryInode === undefined
    )
      throw attention();
    const info = await lstat(record.cwd);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (await realpath(record.cwd)) !== record.cwd ||
      info.dev !== record.directoryDevice ||
      info.ino !== record.directoryInode
    )
      throw attention();
    const pointer = await lstat(join(record.cwd, ".git"));
    if (
      !pointer.isFile() ||
      pointer.isSymbolicLink() ||
      pointer.nlink !== 1 ||
      pointer.size > 4096 ||
      (await readFile(join(record.cwd, ".git"), "utf8")) !== record.pointer
    )
      throw attention();
    if (
      (await agentGit(record.cwd, ["rev-parse", "HEAD"])).trim() !==
        record.baseCommit ||
      (
        await agentGit(record.cwd, ["symbolic-ref", "--short", "HEAD"])
      ).trim() !== record.branch
    )
      throw attention();
  }
  private lease(
    record: WorkflowWorkspaceRecord,
    attemptId: string,
  ): WorkflowWorkspaceLease {
    let released = false;
    return {
      id: record.id,
      cwd: record.cwd,
      validate: async () => {
        if (released || record.activeAttemptId !== attemptId) throw attention();
        await this.verify(record);
      },
      capture: async (summary) => {
        if (released || record.activeAttemptId !== attemptId) throw attention();
        await this.verify(record);
        const increment = await captureIncrement(
          record.cwd,
          record.branch,
          summary,
          undefined,
          { allowEmpty: true, baseCommit: record.baseCommit },
        );
        return increment.files.length ? increment : undefined;
      },
      release: (uncertain) =>
        this.command(async () => {
          if (released) return;
          const current = this.records.find((item) => item.id === record.id);
          if (!current || current.activeAttemptId !== attemptId)
            throw attention();
          const next = {
            ...current,
            phase: uncertain ? ("attention" as const) : ("ready" as const),
            lastAttemptId: attemptId,
          };
          if (!uncertain) delete next.activeAttemptId;
          await this.save(
            this.records.map((item) => (item.id === next.id ? next : item)),
          );
          released = true;
        }),
    };
  }
  acquire(request: WorkflowWorkspaceRequest): Promise<WorkflowWorkspaceLease> {
    return this.command(async () => {
      if (
        !this.ready ||
        request.signal?.aborted ||
        !request.runId ||
        !request.projectId ||
        !request.attemptId
      )
        throw attention();
      if (request.access === "none") {
        const cwd = await realpath(
          await mkdtemp(
            join(
              await realpath(this.temporaryRoot),
              "coforge-workflow-isolated-",
            ),
          ),
        );
        return {
          cwd,
          capture: async () => undefined,
          release: async () => undefined,
        };
      }
      const root = await projectRoot(request.integration);
      const before = this.records.find(
        (record) => record.runId === request.runId,
      );
      if (request.workspaceId && before?.id !== request.workspaceId)
        throw attention();
      if (before) {
        if (before.phase === "retired")
          throw new Error(
            "This workflow workspace was retired because its external agent could not be verified idle. Stop this run and start a fresh workflow after inspection; its files were preserved.",
          );
        if (
          before.projectId !== request.projectId ||
          before.projectPath !== root ||
          before.phase !== "ready" ||
          before.activeAttemptId
        )
          throw attention();
        await this.verify(before);
        if (
          request.access === "editworktree" &&
          !request.integration.allowImplementation
        )
          throw new Error("Real implementation is disabled for this project.");
        const next = { ...before, activeAttemptId: request.attemptId };
        await this.save(
          this.records.map((record) => (record.id === next.id ? next : record)),
        );
        return this.lease(next, request.attemptId);
      }
      if (request.access === "readproject")
        return {
          cwd: root,
          capture: async () => undefined,
          release: async () => undefined,
        };
      if (!request.integration.allowImplementation)
        throw new Error("Real implementation is disabled for this project.");
      const top = await realpath(
        (
          await agentGit(root, ["rev-parse", "--show-toplevel"], request.signal)
        ).trim(),
      );
      if (this.idPrefix === 'bg-' && top !== root) throw new Error('The captured background repository root changed before workspace admission.');
      if (
        (
          await agentGit(
            top,
            ["status", "--porcelain", "--untracked-files=normal"],
            request.signal,
          )
        ).trim()
      )
        throw new Error(
          "The game repository has uncommitted changes. Commit or stash them before creating a workflow workspace.",
        );
      const baseCommit = (
        await agentGit(top, ["rev-parse", "--verify", "HEAD"], request.signal)
      ).trim();
      const folder = request.integration.worktreeFolder.trim()
        ? resolve(request.integration.worktreeFolder.trim())
        : join(dirname(top), `${basename(top)}-coforge-worktrees`);
      await mkdir(folder, { recursive: true });
      const id = `${this.idPrefix}${crypto.randomUUID()}`;
      const reservation: WorkflowWorkspaceRecord = {
        id,
        runId: request.runId,
        projectId: request.projectId,
        projectPath: root,
        cwd: join(await realpath(folder), id),
        branch: `coforge/workflow-${id}`,
        baseCommit,
        phase: "reserved",
        activeAttemptId: request.attemptId,
      };
      if (this.records.length >= 1000)
        throw new Error(
          "Review existing workflow workspace history before creating another.",
        );
      await this.save([...this.records, reservation]);
      try {
        await agentGit(
          top,
          [
            "worktree",
            "add",
            "-b",
            reservation.branch,
            reservation.cwd,
            baseCommit,
          ],
          request.signal,
        );
        const cwd = await realpath(reservation.cwd);
        const info = await lstat(cwd);
        const pointer = await lstat(join(cwd, ".git"));
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          !pointer.isFile() ||
          pointer.isSymbolicLink() ||
          pointer.nlink !== 1 ||
          pointer.size > 4096
        )
          throw attention();
        const next: WorkflowWorkspaceRecord = {
          ...reservation,
          cwd,
          phase: "ready",
          pointer: await readFile(join(cwd, ".git"), "utf8"),
          directoryDevice: info.dev,
          directoryInode: info.ino,
        };
        await this.save(
          this.records.map((record) => (record.id === next.id ? next : record)),
        );
        await this.verify(next);
        return this.lease(next, request.attemptId);
      } catch {
        await this.save(
          this.records.map((record) =>
            record.id === reservation.id
              ? { ...record, phase: "attention" as const }
              : record,
          ),
        ).catch(() => undefined);
        throw attention();
      }
    });
  }
  acknowledge(id: string, attemptId: string, reusable = false): Promise<void> {
    return this.command(async () => {
      if (!this.ready) throw attention();
      const current = this.records.find((record) => record.id === id);
      if (
        current &&
        !current.activeAttemptId &&
        current.reviewedAttemptId === attemptId &&
        current.lastAttemptId === attemptId &&
        (current.phase === "retired" || current.phase === "ready")
      )
        return;
      if (
        !current ||
        !["attention", "ready"].includes(current.phase) ||
        (current.activeAttemptId !== attemptId &&
          (current.activeAttemptId !== undefined ||
            current.lastAttemptId !== attemptId))
      )
        throw attention();
      const next = {
        ...current,
        phase: reusable ? ("ready" as const) : ("retired" as const),
        reviewedAttemptId: attemptId,
        lastAttemptId: attemptId,
      };
      delete next.activeAttemptId;
      if (reusable) {
        try {
          await this.verify(next);
        } catch {
          next.phase = "retired";
        }
      }
      await this.save(
        this.records.map((record) => (record.id === id ? next : record)),
      );
    });
  }
  assertReviewable(
    id: string,
    expected?: import("../../features/coforge/domain/types").Increment,
  ): Promise<void> {
    return this.command(async () => {
      if (!this.ready) throw attention();
      const record = this.records.find((item) => item.id === id);
      if (!record || record.phase !== "ready" || record.activeAttemptId)
        throw new Error(
          "This workspace is still active, uncertain or retired. Inspect its original attempt before reviewing code changes.",
        );
      await this.verify(record);
      if (expected) {
        const actual = await captureIncrement(
          record.cwd,
          record.branch,
          expected.summary,
          undefined,
          { allowEmpty: true, baseCommit: record.baseCommit },
        );
        if (
          actual.diff !== expected.diff ||
          JSON.stringify(actual.files) !== JSON.stringify(expected.files) ||
          actual.branch !== expected.branch ||
          actual.worktree !== expected.worktree
        )
          throw new Error(
            "The workspace changed after its review snapshot. Capture and review the current changes before accepting it.",
          );
      }
    });
  }
}
