import { mkdir, readFile, realpath, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { StageInput } from "../../features/coforge/application/ports";
import type {
  FileChange,
  Increment,
  IntegrationSettings,
} from "../../features/coforge/domain/types";
import { captureProcess } from "./process";

const OUTPUT_LIMIT = 2 * 1024 * 1024;
const DIFF_LIMIT = 160_000;
export async function agentGit(
  cwd: string,
  args: string[],
  signal?: AbortSignal,
  maxBytes = OUTPUT_LIMIT,
): Promise<string> {
  const hooks = join(tmpdir(), "coforge-disabled-git-hooks");
  await mkdir(hooks, { recursive: true });
  return captureProcess(
    "git",
    [
      "-c",
      `core.hooksPath=${hooks}`,
      "-c",
      "core.fsmonitor=false",
      "-c",
      "diff.external=",
      ...args,
    ],
    { cwd, timeoutMs: 30_000, maxBytes, ...(signal ? { signal } : {}) },
  );
}

export async function projectRoot(
  integration: IntegrationSettings,
): Promise<string> {
  if (!integration.projectPath.trim())
    throw new Error(
      "Set the game repository path in the CoForge plugin settings.",
    );
  const folder = await realpath(resolve(integration.projectPath.trim()));
  if (!(await stat(folder)).isDirectory())
    throw new Error("The game repository path is not a folder.");
  return folder;
}

async function newFiles(
  worktree: string,
  files: FileChange[],
  signal?: AbortSignal,
): Promise<string> {
  let diff = "";
  const paths = (
    await agentGit(
      worktree,
      ["ls-files", "--others", "--exclude-standard", "-z"],
      signal,
    )
  )
    .split("\0")
    .filter(Boolean);
  if (paths.length > 100)
    throw new Error(
      "Agent produced more than 100 new files. Review the worktree manually; the increment was not accepted.",
    );
  for (const relative of paths) {
    if (signal?.aborted) throw new Error("Run cancelled.");
    const actual = await realpath(resolve(worktree, relative));
    if (!actual.startsWith(worktree + sep))
      throw new Error(
        "Agent produced an out-of-worktree symlink. Review the worktree manually.",
      );
    const info = await stat(actual);
    if (!info.isFile()) continue;
    if (info.size > 256_000) {
      files.push({ path: relative, additions: 0, deletions: 0 });
      diff += `\nNew file ${relative}: ${info.size} bytes; omitted from preview.\n`;
      continue;
    }
    const buffer = await readFile(actual);
    const binary = buffer.includes(0);
    const lines = binary
      ? []
      : buffer.toString("utf8").replace(/\n$/, "").split("\n");
    files.push({ path: relative, additions: lines.length, deletions: 0 });
    diff += binary
      ? `\nNew binary file: ${relative}\n`
      : `\ndiff --git a/${relative} b/${relative}\nnew file mode 100644\n--- /dev/null\n+++ b/${relative}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}\n`;
  }
  return diff;
}

/** Captures the actual changed files and diff of a worktree. Tests are always reported as not run. */
export async function captureIncrement(
  worktree: string,
  branch: string,
  summary: string,
  signal?: AbortSignal,
): Promise<Increment> {
  const files: FileChange[] = (
    await agentGit(
      worktree,
      ["diff", "--no-ext-diff", "--no-textconv", "--numstat", "HEAD", "--"],
      signal,
    )
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [add, remove, ...name] = line.split("\t");
      return {
        path: name.join("\t"),
        additions: Number(add) || 0,
        deletions: Number(remove) || 0,
      };
    });
  let diff = await agentGit(
    worktree,
    ["diff", "--no-ext-diff", "--no-textconv", "--no-color", "HEAD", "--"],
    signal,
  );
  diff += await newFiles(worktree, files, signal);
  if (!files.length)
    throw new Error(
      "Claude produced no changed files. The idea remains planned; inspect the run before retrying.",
    );
  return {
    summary,
    files,
    branch,
    worktree,
    createdAt: new Date().toISOString(),
    simulated: false,
    diff:
      diff.slice(0, DIFF_LIMIT) +
      (diff.length > DIFF_LIMIT
        ? "\n[Preview truncated. Inspect the full worktree before accepting.]"
        : ""),
    tests: [
      "Not run: shell tools are disabled. Run the game’s checks in this worktree and inspect the diff before accepting.",
    ],
  };
}

export async function prepareWorktree(
  input: StageInput,
  root: string,
  onLog: (message: string) => void,
): Promise<{ cwd: string; branch: string; pointer: Buffer }> {
  const { idea, integration, signal } = input;
  if (!integration.allowImplementation)
    throw new Error(
      "Real implementation is disabled. Enable it for this project in Project settings after reviewing the integration guide.",
    );
  if (!idea.plan)
    throw new Error("An implementation plan is required before building.");
  const top = await realpath(
    (await agentGit(root, ["rev-parse", "--show-toplevel"], signal)).trim(),
  );
  await agentGit(top, ["rev-parse", "--verify", "HEAD"], signal);
  if (
    (
      await agentGit(
        top,
        ["status", "--porcelain", "--untracked-files=normal"],
        signal,
      )
    ).trim()
  )
    throw new Error(
      "The game repository has uncommitted changes. Commit or stash them before building; CoForge will not alter or discard them.",
    );
  const runName = `${idea.id.toLowerCase().replace(/[^a-z0-9-]/g, "")}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const branch = `coforge/${runName}`;
  const folder = integration.worktreeFolder.trim()
    ? resolve(integration.worktreeFolder.trim())
    : join(dirname(top), `${basename(top)}-coforge-worktrees`);
  await mkdir(folder, { recursive: true });
  await agentGit(
    top,
    ["worktree", "add", "-b", branch, join(folder, runName), "HEAD"],
    signal,
  );
  const cwd = await realpath(join(folder, runName));
  onLog(`Created branch ${branch}. Worktree: ${cwd}`);
  return { cwd, branch, pointer: await readFile(join(cwd, ".git")) };
}
