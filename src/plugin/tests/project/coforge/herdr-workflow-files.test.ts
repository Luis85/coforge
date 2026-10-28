// @vitest-environment happy-dom
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalHerdrAttemptFiles } from "../../../infrastructure/coforge/herdr-workflow-files";
import { captureProcess } from "../../../infrastructure/coforge/process";
import {
  createSeed,
  defaultIntegration,
  defaultSettings,
} from "../../../features/coforge/domain/seed";
import type { StageInput } from "../../../features/coforge/application/ports";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0))
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
});
async function fixture(stage: StageInput["stage"] = "screen") {
  const root = await mkdtemp(join(tmpdir(), "coforge-herdr-files-test-"));
  folders.push(root);
  const repository = join(root, "game");
  await mkdir(repository);
  const input = {
    jobId: "job-one",
    stage,
    idea: createSeed().ideas[0]!,
    settings: defaultSettings(),
    integration: {
      ...defaultIntegration(),
      projectPath: repository,
      worktreeFolder: join(root, "worktrees"),
      allowImplementation: true,
    },
  };
  return { root, repository, input, files: new LocalHerdrAttemptFiles(root) };
}
const screen = {
  verdict: "clear",
  reason: "Useful \u202e feature.",
  signals: [],
};
const plan = {
  summary: "Build it",
  steps: ["Add it"],
  acceptanceCriteria: ["Works"],
  risks: [],
};

describe("private Herdr workflow files", () => {
  it("isolates classification, starts with a fresh absent result and preserves recovery files on disposal", async () => {
    const { input, files, repository } = await fixture();
    const area = await files.prepare(input);
    expect(area.cwd).not.toBe(repository);
    expect(dirname(area.resultPath)).toBe(area.cwd);
    expect(await area.readResult()).toBeNull();
    await writeFile(area.resultPath, JSON.stringify({ output: screen }));
    expect(await area.readResult()).toEqual({ output: screen });
    const result = await area.finish(screen);
    expect(result.screening).toMatchObject({
      provider: "herdr",
      verdict: "clear",
    });
    expect(result.screening?.reason).not.toContain("\u202e");
    await expect(
      area.finish({ ...screen, costUsd: 0, approved: true }),
    ).rejects.toThrow();
    await area.dispose();
    expect((await lstat(area.cwd)).isDirectory()).toBe(true);
    expect(await readFile(area.resultPath, "utf8")).toContain("output");
    const other = await files.prepare(input);
    expect(other.cwd).not.toBe(area.cwd);
    expect(await other.readResult()).toBeNull();
  });
  it("keeps planning artifacts outside the project and validates scoring and planning schemas", async () => {
    const { input, files, repository } = await fixture("plan");
    const area = await files.prepare(input);
    expect(area.cwd).toBe(await realpath(repository));
    expect(area.resultPath.startsWith(await realpath(repository))).toBe(false);
    expect((await area.finish(plan)).plan?.markdown).toContain("Build it");
    await expect(area.finish({ ...plan, tests: ["passed"] })).rejects.toThrow();
    const score = await files.prepare({ ...input, stage: "score" });
    expect(
      (
        await score.finish({
          reach: 100,
          impact: 2,
          confidence: 0.5,
          effort: 2,
          rationale: "Useful",
        })
      ).rice?.score,
    ).toBe(50);
  });
  it("rejects result directories, oversized data, malformed UTF-8, invalid JSON, hardlinks and replaced owned parents", async () => {
    const { files, input, root } = await fixture();
    const area = await files.prepare(input);
    await mkdir(area.resultPath);
    await expect(area.readResult()).rejects.toThrow();
    await rm(area.resultPath, { recursive: true });
    await writeFile(area.resultPath, Buffer.alloc(512 * 1024 + 1, 32));
    await expect(area.readResult()).rejects.toThrow();
    await writeFile(area.resultPath, Buffer.from([0xff, 0xfe]));
    await expect(area.readResult()).rejects.toThrow();
    await writeFile(area.resultPath, "{broken");
    await expect(area.readResult()).rejects.toThrow();
    await rm(area.resultPath);
    const outside = join(root, "external.json");
    await writeFile(outside, "{}");
    await link(outside, area.resultPath);
    await expect(area.readResult()).rejects.toThrow();
    await rm(area.resultPath);
    await rename(area.cwd, `${area.cwd}-original`);
    await mkdir(area.cwd);
    await writeFile(area.resultPath, "{}");
    await expect(area.readResult()).rejects.toThrow();
  });
  it.skipIf(process.platform === "win32")(
    "rejects result and parent symlink escapes",
    async () => {
      const { files, input, root } = await fixture();
      const area = await files.prepare(input);
      const outside = join(root, "external.json");
      await writeFile(outside, "{}");
      await symlink(outside, area.resultPath);
      await expect(area.readResult()).rejects.toThrow();
      await rm(area.resultPath);
      await rename(area.cwd, `${area.cwd}-original`);
      await symlink(`${area.cwd}-original`, area.cwd, "dir");
      await expect(area.readResult()).rejects.toThrow();
    },
  );
  it("builds in a clean isolated worktree, excludes private artifacts and captures actual file changes only", async () => {
    const { files, input, repository } = await fixture("implement");
    await captureProcess("git", ["init", "-q"], { cwd: repository });
    await writeFile(join(repository, "game.txt"), "before\n");
    await captureProcess("git", ["add", "game.txt"], { cwd: repository });
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
      { cwd: repository },
    );
    const attempt = {
      ...input,
      idea: {
        ...input.idea,
        plan: {
          ...plan,
          markdown: "Plan",
          createdAt: new Date().toISOString(),
        },
      },
    };
    const excludePath = join(repository, ".git", "info", "exclude");
    const existingExclude = Buffer.from(
      "# preserve these bytes\r\nexisting-rule\n",
    );
    await writeFile(excludePath, existingExclude);
    await writeFile(join(repository, "game.txt"), "uncommitted user work\n");
    await expect(files.prepare(attempt)).rejects.toThrow("uncommitted changes");
    expect(await readFile(join(repository, "game.txt"), "utf8")).toBe(
      "uncommitted user work\n",
    );
    await writeFile(join(repository, "game.txt"), "before\n");
    const area = await files.prepare(attempt);
    expect(area.cwd).not.toBe(repository);
    const updatedExclude = await readFile(excludePath);
    expect(updatedExclude.subarray(0, existingExclude.length)).toEqual(
      existingExclude,
    );
    expect(updatedExclude.toString()).toContain("/.coforge-run-output/");
    await expect(area.finish({ summary: "Claims a change" })).rejects.toThrow(
      "no changed files",
    );
    await writeFile(
      area.resultPath,
      JSON.stringify({ output: { summary: "Changed actual file" } }),
    );
    await writeFile(join(area.cwd, "game.txt"), "after\n");
    const result = await area.finish({ summary: "Changed actual file" });
    expect(result.increment?.files).toEqual([
      { path: "game.txt", additions: 1, deletions: 1 },
    ]);
    expect(result.increment?.diff).toContain("+after");
    expect(result.increment?.diff).not.toContain("coforge-run-output");
    expect(result.increment?.tests[0]).toContain("Not run");
    expect(await readFile(join(repository, "game.txt"), "utf8")).toBe(
      "before\n",
    );
    await expect(
      area.finish({ summary: "Invented success", tests: ["passed"] }),
    ).rejects.toThrow();
    await rm(join(area.cwd, ".git"), { force: true });
    await writeFile(join(area.cwd, ".git"), "gitdir: /nonexistent");
    await expect(
      area.finish({ summary: "Attempted metadata change" }),
    ).rejects.toThrow("Git metadata changed unexpectedly");
    await area.dispose();
    expect((await lstat(area.cwd)).isDirectory()).toBe(true);
  });
  it("rejects implementation before repository mutation when it is disabled", async () => {
    const { files, input } = await fixture("implement");
    await expect(
      files.prepare({
        ...input,
        integration: { ...input.integration, allowImplementation: false },
      }),
    ).rejects.toThrow("implementation is disabled");
  });
});
