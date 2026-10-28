// @vitest-environment happy-dom
import {
  mkdir,
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { LocalWorkflowWorkspaces } from "../../../infrastructure/coforge/workflow-workspaces";
import type {
  WorkflowWorkspaceRecord,
  WorkflowWorkspaceRequest,
} from "../../../features/coforge/application/workflow-workspace-ports";
import { defaultIntegration } from "../../../features/coforge/domain/seed";
import { captureProcess } from "../../../infrastructure/coforge/process";
const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0))
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
}, 30000);
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), "coforge-workflow-workspace-"));
  folders.push(folder);
  const root = join(folder, "game");
  await mkdir(root);
  await captureProcess("git", ["init", "-q"], { cwd: root });
  await writeFile(join(root, "game.txt"), "original\n");
  await captureProcess("git", ["add", "game.txt"], { cwd: root });
  await captureProcess(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "fixture",
    ],
    { cwd: root },
  );
  let saved: WorkflowWorkspaceRecord[] = [];
  const phases: string[] = [];
  const storage = {
    load: async () => structuredClone(saved),
    save: async (records: WorkflowWorkspaceRecord[]) => {
      if (records[0]?.phase === "reserved")
        await expect(lstat(records[0].cwd)).rejects.toMatchObject({
          code: "ENOENT",
        });
      phases.push(records[0]?.phase ?? "none");
      saved = structuredClone(records);
    },
  };
  const service = new LocalWorkflowWorkspaces(storage, folder);
  await service.start();
  const request: WorkflowWorkspaceRequest = {
    runId: "run-one",
    projectId: "CFP-001",
    attemptId: "attempt-one",
    access: "editworktree",
    integration: {
      ...defaultIntegration(),
      projectPath: root,
      worktreeFolder: join(folder, "worktrees"),
      allowImplementation: true,
    },
  };
  return {
    folder,
    root,
    storage,
    phases,
    service,
    request,
    records: () => saved,
  };
}
it("journals reservation before ready, shares the worktree with later readers/editors, and captures cumulative actual changes", async () => {
  const { root, service, request, phases, records } = await fixture();
  const first = await service.acquire(request);
  expect(phases.slice(0, 2)).toEqual(["reserved", "ready"]);
  expect(records()[0]).toMatchObject({
    id: first.id,
    runId: request.runId,
    activeAttemptId: request.attemptId,
    phase: "ready",
  });
  expect(records()[0]?.pointer).toContain("gitdir:");
  expect(first.cwd).not.toBe(await realpath(root));
  expect(await first.capture("Nothing changed")).toBeUndefined();
  await writeFile(join(first.cwd, "game.txt"), "changed\n");
  expect((await first.capture("Report task edited code"))?.diff).toContain(
    "+changed",
  );
  await expect(service.assertReviewable(first.id!)).rejects.toThrow('active');
  await first.release();
  const reader = await service.acquire({
    ...request,
    access: "readproject",
    attemptId: "attempt-two",
    workspaceId: first.id,
  });
  expect(reader.cwd).toBe(first.cwd);
  expect(await readFile(join(reader.cwd, "game.txt"), "utf8")).toBe(
    "changed\n",
  );
  await reader.release();
  const pending = await service.acquire({ ...request, access: 'readproject', attemptId: 'review-snapshot' });
  const expected = await pending.capture('Expected snapshot');
  await pending.release();
  await service.assertReviewable(pending.id!, expected);
  await writeFile(join(pending.cwd, 'game.txt'), 'changed after snapshot\n');
  await expect(service.assertReviewable(pending.id!, expected)).rejects.toThrow('changed after');
  const editor = await service.acquire({
    ...request,
    attemptId: "attempt-three",
    workspaceId: first.id,
  });
  expect(editor.cwd).toBe(first.cwd);
  expect(await readFile(join(root, "game.txt"), "utf8")).toBe("original\n");
  await editor.release();
  await expect(
    service.acknowledge(editor.id!, "attempt-two"),
  ).rejects.toThrow();
  await service.acknowledge(editor.id!, "attempt-three");
  await service.acknowledge(editor.id!, "attempt-three");
  await expect(
    service.acquire({ ...request, attemptId: "attempt-four" }),
  ).rejects.toThrow("retired");
}, 30000);
it("keeps uncertain or reloaded active attempts held until explicit recovery, without replaying Git creation", async () => {
  const { service, request, storage, folder, records } = await fixture();
  const first = await service.acquire(request);
  const reloaded = new LocalWorkflowWorkspaces(storage, folder);
  await reloaded.start();
  expect(records()[0]?.phase).toBe("attention");
  await expect(
    reloaded.acquire({ ...request, attemptId: "attempt-two" }),
  ).rejects.toThrow("attention");
  await expect(
    reloaded.acknowledge(first.id!, "wrong-attempt"),
  ).rejects.toThrow();
  await reloaded.acknowledge(first.id!, request.attemptId, true);
  const next = await reloaded.acquire({
    ...request,
    attemptId: "attempt-two",
    workspaceId: first.id,
  });
  expect(next.cwd).toBe(first.cwd);
  await next.release(true);
  await expect(
    reloaded.acquire({ ...request, attemptId: "attempt-three" }),
  ).rejects.toThrow("attention");
  await reloaded.acknowledge(first.id!, "attempt-two");
  await expect(
    reloaded.acquire({ ...request, attemptId: "attempt-three" }),
  ).rejects.toThrow("retired");
}, 30000);
it("refuses a lost workspace or tampered Git pointer and never falls back to the original repository", async () => {
  const { service, request } = await fixture();
  const first = await service.acquire(request);
  await first.release();
  await rm(join(first.cwd, ".git"), { force: true });
  await writeFile(join(first.cwd, ".git"), "gitdir: /not-owned");
  await expect(
    service.acquire({
      ...request,
      access: "readproject",
      attemptId: "attempt-two",
    }),
  ).rejects.toThrow();
}, 30000);
it("isolates none access and validates project editing authorization before creating a worktree", async () => {
  const { service, request, root } = await fixture();
  await expect(
    service.acquire({
      ...request,
      integration: { ...request.integration, allowImplementation: false },
    }),
  ).rejects.toThrow("disabled");
  const reader = await service.acquire({ ...request, access: "readproject" });
  expect(reader.cwd).toBe(await realpath(root));
  expect(reader.id).toBeUndefined();
  const isolated = await service.acquire({ ...request, access: "none", integration: { ...request.integration, projectPath: '' } });
  expect(isolated.cwd).not.toBe(reader.cwd);
  expect(isolated.id).toBeUndefined();
  await isolated.release();
}, 30000);
it("does not return a launchable lease when actual descriptor persistence fails, and never replays it on reload", async () => {
  const { service, request, storage, folder, records, root } = await fixture();
  const save = storage.save;
  storage.save = async (next) => {
    if (next[0]?.phase === "ready")
      throw new Error("synthetic storage failure");
    await save(next);
  };
  await expect(service.acquire(request)).rejects.toThrow("attention");
  expect(records()[0]?.phase).toBe("attention");
  expect((await lstat(records()[0]!.cwd)).isDirectory()).toBe(true);
  const reloaded = new LocalWorkflowWorkspaces(storage, folder);
  await reloaded.start();
  await expect(
    reloaded.acquire({ ...request, attemptId: "attempt-two" }),
  ).rejects.toThrow("attention");
  expect(await readFile(join(root, "game.txt"), "utf8")).toBe("original\n");
}, 30000);
