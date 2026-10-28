import { constants, type Stats } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { TextDecoder } from "node:util";
import type {
  HerdrAttemptArea,
  HerdrAttemptFiles,
} from "../../features/coforge/application/herdr-workflow-ports";
import type {
  StageInput,
  StageResult,
} from "../../features/coforge/application/ports";
import {
  implementationOutput,
  planOutput,
  scoreOutput,
  screeningOutput,
} from "../../features/coforge/application/agent-prompts";
import { cleanDeep } from "../../features/coforge/domain/sanitize";
import { planMarkdown, riceValue } from "../../features/coforge/domain/types";
import {
  agentGit,
  captureIncrement,
  prepareWorktree,
  projectRoot,
} from "./agent-worktree";

const RESULT_LIMIT = 512 * 1024;
const invalid = () =>
  new Error(
    "The private Herdr result file or its owned directory changed or is invalid. Inspect the original attempt.",
  );
const missing = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
const sameIdentity = (left: Stats, right: Stats) =>
  left.dev === right.dev && left.ino === right.ino;
interface Directory {
  path: string;
  identity: Stats;
}
async function ownedDirectory(path: string): Promise<Directory> {
  const actual = await realpath(path);
  const identity = await lstat(path);
  if (!identity.isDirectory() || identity.isSymbolicLink() || actual !== path)
    throw invalid();
  return { path, identity };
}
async function checkDirectories(directories: Directory[]): Promise<void> {
  for (const directory of directories) {
    const current = await ownedDirectory(directory.path);
    if (!sameIdentity(current.identity, directory.identity)) throw invalid();
  }
}

/** Append one private pattern without rewriting the user's existing exclude bytes. */
async function ignoreArtifacts(
  cwd: string,
  signal?: AbortSignal,
): Promise<void> {
  const common = await realpath(
    resolve(
      cwd,
      (await agentGit(cwd, ["rev-parse", "--git-common-dir"], signal)).trim(),
    ),
  );
  const commonDirectory = await ownedDirectory(common);
  const infoPath = join(common, "info");
  await mkdir(infoPath, { recursive: true });
  const info = await ownedDirectory(infoPath);
  const exclude = join(infoPath, "exclude");
  const before = await lstat(exclude).catch((error: unknown) => {
    if (missing(error)) return undefined;
    throw error;
  });
  if (
    before &&
    (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
  )
    throw invalid();
  const handle = await open(
    exclude,
    constants.O_RDWR |
      constants.O_APPEND |
      constants.O_CREAT |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await checkDirectories([commonDirectory, info]);
    const opened = await handle.stat();
    const current = await lstat(exclude);
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.size > 1024 * 1024 ||
      current.isSymbolicLink() ||
      !sameIdentity(opened, current) ||
      (before && !sameIdentity(before, opened))
    )
      throw invalid();
    await handle.writeFile("\n/.coforge-run-output/\n");
    await checkDirectories([commonDirectory, info]);
    if (!sameIdentity(await handle.stat(), await lstat(exclude)))
      throw invalid();
  } finally {
    await handle.close();
  }
}

/** Bounded reads from the opened regular file; pathname and parent identity are checked before and after. */
async function readResult(
  path: string,
  directories: Directory[],
): Promise<unknown | null> {
  try {
    await checkDirectories(directories);
    const before = await lstat(path).catch((error: unknown) => {
      if (missing(error)) return undefined;
      throw error;
    });
    if (!before) return null;
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > RESULT_LIMIT ||
      (await realpath(path)) !== path
    )
      throw invalid();
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (
        !sameIdentity(before, opened) ||
        !opened.isFile() ||
        opened.nlink !== 1 ||
        opened.size > RESULT_LIMIT
      )
        throw invalid();
      const buffer = Buffer.alloc(RESULT_LIMIT + 1);
      let bytes = 0;
      while (bytes < buffer.length) {
        const chunk = await handle.read(
          buffer,
          bytes,
          buffer.length - bytes,
          bytes,
        );
        if (!chunk.bytesRead) break;
        bytes += chunk.bytesRead;
      }
      const after = await handle.stat();
      await checkDirectories(directories);
      const current = await lstat(path);
      if (
        bytes > RESULT_LIMIT ||
        !sameIdentity(opened, current) ||
        current.isSymbolicLink() ||
        current.nlink !== 1 ||
        after.size !== opened.size ||
        after.mtimeMs !== opened.mtimeMs ||
        after.ctimeMs !== opened.ctimeMs
      )
        throw invalid();
      const value: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          buffer.subarray(0, bytes),
        ),
      );
      if (value === null) throw invalid();
      return value;
    } finally {
      await handle.close();
    }
  } catch {
    throw invalid();
  }
}

/** Local filesystem boundary only. External agent lifetime belongs to the workflow coordinator. */
export class LocalHerdrAttemptFiles implements HerdrAttemptFiles {
  constructor(private readonly temporaryRoot = tmpdir()) {}
  async prepare(
    input: StageInput & { jobId: string },
  ): Promise<HerdrAttemptArea> {
    if (input.signal?.aborted) throw new Error("Run cancelled.");
    if (!input.jobId.trim())
      throw new Error(
        "A workflow job is required before preparing Herdr files.",
      );
    const temp = await realpath(this.temporaryRoot);
    let cwd: string;
    let artifact: string;
    let worktree: Awaited<ReturnType<typeof prepareWorktree>> | undefined;
    const directories: Directory[] = [];
    if (input.stage === "screen" || input.stage === "score") {
      cwd = artifact = await realpath(
        await mkdtemp(join(temp, "coforge-herdr-classifier-")),
      );
    } else {
      cwd = await projectRoot(input.integration);
      if (input.stage === "implement") {
        worktree = await prepareWorktree(input, cwd, () => undefined);
        cwd = worktree.cwd;
        await ignoreArtifacts(cwd, input.signal);
        const artifacts = join(cwd, ".coforge-run-output");
        await mkdir(artifacts, { mode: 0o700 });
        directories.push(await ownedDirectory(artifacts));
        artifact = await mkdtemp(join(artifacts, "attempt-"));
      } else
        artifact = await realpath(
          await mkdtemp(join(temp, "coforge-herdr-plan-")),
        );
    }
    directories.push(await ownedDirectory(cwd));
    if (artifact !== cwd) directories.push(await ownedDirectory(artifact));
    const resultPath = join(artifact, "result.json");
    if (
      await lstat(resultPath).then(
        () => true,
        (error: unknown) => {
          if (missing(error)) return false;
          throw error;
        },
      )
    )
      throw invalid();
    return {
      cwd,
      resultPath,
      readResult: () => readResult(resultPath, directories),
      finish: async (raw): Promise<StageResult> => {
        await checkDirectories(directories);
        const output = cleanDeep(raw);
        const now = new Date().toISOString();
        if (input.stage === "screen")
          return {
            screening: {
              ...screeningOutput(output),
              checkedAt: now,
              provider: "herdr",
            },
          };
        if (input.stage === "score") {
          const score = scoreOutput(output);
          return { rice: { ...score, score: riceValue(score) } };
        }
        if (input.stage === "plan") {
          const plan = planOutput(output);
          return {
            plan: {
              ...plan,
              markdown: planMarkdown(plan, input.idea.title),
              createdAt: now,
            },
          };
        }
        const result = implementationOutput(output);
        if (!worktree) throw new Error("The build worktree is missing.");
        const pointerPath = join(worktree.cwd, ".git");
        if (
          !(await lstat(pointerPath)).isFile() ||
          !(await readFile(pointerPath)).equals(worktree.pointer)
        )
          throw new Error(
            "The worktree Git metadata changed unexpectedly. No Git inspection was run; inspect this worktree manually.",
          );
        return {
          increment: await captureIncrement(
            worktree.cwd,
            worktree.branch,
            result.summary,
            input.signal,
          ),
        };
      },
      // A timeout/cancellation does not confirm that the external process has stopped.
      dispose: async () => undefined,
    };
  }
}
