import { lstat, mkdir, mkdtemp, readFile, realpath, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, dirname, join, resolve, sep } from 'path';
import { implementationOutput, planOutput, scoreOutput, screeningOutput, stageInput } from '../../features/coforge/application/agent-prompts';
import { buildClaudeArgs, parseClaudeEnvelope, supportsRequiredVersion } from '../../features/coforge/application/claude-protocol';
import type { StageInput, StageResult } from '../../features/coforge/application/ports';
import { CheckError } from '../../features/coforge/domain/check';
import { cleanDeep } from '../../features/coforge/domain/sanitize';
import type { FileChange, Increment, IntegrationSettings } from '../../features/coforge/domain/types';
import { planMarkdown, riceValue } from '../../features/coforge/domain/types';
import { captureProcess } from './process';

const OUTPUT_LIMIT = 2 * 1024 * 1024;
const DIFF_LIMIT = 160_000;

function executable(integration: IntegrationSettings): string {
  const command = integration.claudeBin.trim() || 'claude';
  if (/\.(cmd|bat)$/i.test(command)) throw new Error('Set the Claude executable to the native claude.exe, not a .cmd/.bat shim. Shell execution is disabled.');
  return command;
}

/** Probes the native CLI version. No model request is made. */
export async function probeClaude(integration: IntegrationSettings): Promise<{ cliAvailable: boolean; projectPath: string | null; allowImplementation: boolean }> {
  const projectPath = integration.projectPath.trim() ? resolve(integration.projectPath.trim()) : null;
  let cliAvailable = false;
  try {
    const version = await captureProcess(executable(integration), ['--version'], { cwd: tmpdir(), timeoutMs: 5000, maxBytes: 8000 });
    cliAvailable = supportsRequiredVersion(version);
  } catch { /* Shown as unavailable. */ }
  return { cliAvailable, projectPath, allowImplementation: integration.allowImplementation };
}

async function git(cwd: string, args: string[], signal?: AbortSignal, maxBytes = OUTPUT_LIMIT): Promise<string> {
  const hooks = join(tmpdir(), 'coforge-disabled-git-hooks');
  await mkdir(hooks, { recursive: true });
  return captureProcess('git', ['-c', `core.hooksPath=${hooks}`, '-c', 'core.fsmonitor=false', '-c', 'diff.external=', ...args], { cwd, timeoutMs: 30_000, maxBytes, ...(signal ? { signal } : {}) });
}

async function projectRoot(integration: IntegrationSettings): Promise<string> {
  if (!integration.projectPath.trim()) throw new Error('Set the game repository path in the CoForge plugin settings.');
  const folder = await realpath(resolve(integration.projectPath.trim()));
  if (!(await stat(folder)).isDirectory()) throw new Error('The game repository path is not a folder.');
  return folder;
}

async function newFiles(worktree: string, files: FileChange[], signal?: AbortSignal): Promise<string> {
  let diff = '';
  const paths = (await git(worktree, ['ls-files', '--others', '--exclude-standard', '-z'], signal)).split('\0').filter(Boolean);
  if (paths.length > 100) throw new Error('Agent produced more than 100 new files. Review the worktree manually; the increment was not accepted.');
  for (const relative of paths) {
    if (signal?.aborted) throw new Error('Run cancelled.');
    const actual = await realpath(resolve(worktree, relative));
    if (!actual.startsWith(worktree + sep)) throw new Error('Agent produced an out-of-worktree symlink. Review the worktree manually.');
    const info = await stat(actual);
    if (!info.isFile()) continue;
    if (info.size > 256_000) { files.push({ path: relative, additions: 0, deletions: 0 }); diff += `\nNew file ${relative}: ${info.size} bytes; omitted from preview.\n`; continue; }
    const buffer = await readFile(actual);
    const binary = buffer.includes(0);
    const lines = binary ? [] : buffer.toString('utf8').replace(/\n$/, '').split('\n');
    files.push({ path: relative, additions: lines.length, deletions: 0 });
    diff += binary ? `\nNew binary file: ${relative}\n`
      : `\ndiff --git a/${relative} b/${relative}\nnew file mode 100644\n--- /dev/null\n+++ b/${relative}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}`).join('\n')}\n`;
  }
  return diff;
}

/** Captures the actual changed files and diff of a worktree. Tests are always reported as not run. */
async function captureIncrement(worktree: string, branch: string, summary: string, signal?: AbortSignal): Promise<Increment> {
  const files: FileChange[] = (await git(worktree, ['diff', '--no-ext-diff', '--no-textconv', '--numstat', 'HEAD', '--'], signal)).trim().split('\n').filter(Boolean).map(line => {
    const [add, remove, ...name] = line.split('\t');
    return { path: name.join('\t'), additions: Number(add) || 0, deletions: Number(remove) || 0 };
  });
  let diff = await git(worktree, ['diff', '--no-ext-diff', '--no-textconv', '--no-color', 'HEAD', '--'], signal);
  diff += await newFiles(worktree, files, signal);
  if (!files.length) throw new Error('Claude produced no changed files. The idea remains planned; inspect the run before retrying.');
  return {
    summary, files, branch, worktree, createdAt: new Date().toISOString(), simulated: false,
    diff: diff.slice(0, DIFF_LIMIT) + (diff.length > DIFF_LIMIT ? '\n[Preview truncated. Inspect the full worktree before accepting.]' : ''),
    tests: ['Not run: shell tools are disabled. Run the game’s checks in this worktree and inspect the diff before accepting.'],
  };
}

async function prepareWorktree(input: StageInput, root: string, onLog: (message: string) => void): Promise<{ cwd: string; branch: string; pointer: Buffer }> {
  const { idea, integration, signal } = input;
  if (!integration.allowImplementation) throw new Error('Real implementation is disabled. Enable it in the CoForge plugin settings after reviewing the integration guide.');
  if (!idea.plan) throw new Error('An implementation plan is required before building.');
  const top = await realpath((await git(root, ['rev-parse', '--show-toplevel'], signal)).trim());
  await git(top, ['rev-parse', '--verify', 'HEAD'], signal);
  if ((await git(top, ['status', '--porcelain', '--untracked-files=normal'], signal)).trim())
    throw new Error('The game repository has uncommitted changes. Commit or stash them before building; CoForge will not alter or discard them.');
  const runName = `${idea.id.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const branch = `coforge/${runName}`;
  const folder = integration.worktreeFolder.trim() ? resolve(integration.worktreeFolder.trim()) : join(dirname(top), `${basename(top)}-coforge-worktrees`);
  await mkdir(folder, { recursive: true });
  await git(top, ['worktree', 'add', '-b', branch, join(folder, runName), 'HEAD'], signal);
  const cwd = await realpath(join(folder, runName));
  onLog(`Created branch ${branch}. Worktree: ${cwd}`);
  return { cwd, branch, pointer: await readFile(join(cwd, '.git')) };
}

async function interpret(input: StageInput, output: unknown, costUsd: number | undefined, worktree: { cwd: string; branch: string; pointer: Buffer } | null, onLog: (message: string) => void): Promise<StageResult> {
  const cost = costUsd === undefined ? {} : { costUsd };
  const now = new Date().toISOString();
  if (input.stage === 'screen') return { screening: { ...screeningOutput(output), checkedAt: now, provider: 'claude' }, ...cost };
  if (input.stage === 'score') { const score = scoreOutput(output); return { rice: { ...score, score: riceValue(score) }, ...cost }; }
  if (input.stage === 'plan') { const plan = planOutput(output); return { plan: { ...plan, markdown: planMarkdown(plan, input.idea.title), createdAt: now }, ...cost }; }
  const result = implementationOutput(output);
  if (!worktree) throw new Error('The build worktree is missing.');
  const pointerPath = join(worktree.cwd, '.git');
  if (!(await lstat(pointerPath)).isFile() || !(await readFile(pointerPath)).equals(worktree.pointer))
    throw new Error('The worktree Git metadata changed unexpectedly. No Git inspection was run; inspect this worktree manually.');
  const increment = await captureIncrement(worktree.cwd, worktree.branch, result.summary, input.signal);
  onLog(`Captured ${increment.files.length} changed files. Tests not run. Human review required; nothing merged or deployed.`);
  return { increment, ...cost };
}

/** Runs one stage through the native Claude Code CLI with stage-specific tool restrictions. */
export async function runClaudeStage(input: StageInput): Promise<StageResult> {
  const { stage, idea, settings, integration, signal } = input;
  const onLog = input.onLog ?? (() => undefined);
  if (signal?.aborted) throw new Error('Run cancelled.');
  let cwd: string; let temporary: string | undefined; let worktree: { cwd: string; branch: string; pointer: Buffer } | null = null;
  if (stage === 'screen' || stage === 'score') cwd = temporary = await mkdtemp(join(tmpdir(), 'coforge-classifier-'));
  else {
    cwd = await projectRoot(integration);
    if (stage === 'implement') { worktree = await prepareWorktree(input, cwd, onLog); cwd = worktree.cwd; }
  }
  try {
    onLog(`Claude ${stage}: ${stage === 'screen' || stage === 'score' ? 'no tools; isolated temporary directory' : stage === 'plan' ? 'read-only repository access' : 'file editing in a separate worktree'}.`);
    const raw = await captureProcess(executable(integration), buildClaudeArgs(stage, settings), {
      cwd, input: stageInput(stage, idea, settings), timeoutMs: settings.timeoutSeconds * 1000, ...(signal ? { signal } : {}),
    });
    const envelope = parseClaudeEnvelope(raw);
    // Model output is saved to notes and shown to viewers: it gets the same sanitizing as chat before validation.
    return await interpret(input, cleanDeep(envelope.output), envelope.costUsd, worktree, onLog);
  } catch (error) {
    if (error instanceof CheckError) throw new Error('Claude output failed schema validation. The idea was not advanced.');
    if (error instanceof Error && /unknown (?:option|argument)|unrecognized (?:option|argument)|unexpected (?:option|argument)/i.test(error.message))
      throw new Error(`Update native Claude Code to the current release; required restricted/safe-mode/structured-output flags are not supported. No permissive fallback is used. ${error.message}`);
    throw error;
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
