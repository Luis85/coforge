import { lstat, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { implementationOutput, planOutput, scoreOutput, screeningOutput, stageInput } from '../../features/coforge/application/agent-prompts';
import { buildClaudeArgs, parseClaudeEnvelope, reportedClaudeCost, reportedClaudeUsage, supportsRequiredVersion } from '../../features/coforge/application/claude-protocol';
import type { StageInput, StageResult } from '../../features/coforge/application/ports';
import { CheckError } from '../../features/coforge/domain/check';
import { cleanDeep } from '../../features/coforge/domain/sanitize';
import type { IntegrationSettings } from '../../features/coforge/domain/types';
import { planMarkdown, riceValue } from '../../features/coforge/domain/types';
import { captureProcess, ProcessFailure } from './process';
import { captureIncrement, prepareWorktree, projectRoot } from './agent-worktree';

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
    const usage = reportedClaudeCost(raw); if (usage !== undefined) await input.onUsage?.(usage);
    const tokens = reportedClaudeUsage(raw); if (tokens) await input.onTokenUsage?.(tokens);
    const envelope = parseClaudeEnvelope(raw);
    // Model output is saved to notes and shown to viewers: it gets the same sanitizing as chat before validation.
    const result = await interpret(input, cleanDeep(envelope.output), envelope.costUsd, worktree, onLog);
    return { ...result, ...(tokens ? { usage: tokens } : {}) };
  } catch (error) {
    if (error instanceof ProcessFailure) { const usage = reportedClaudeCost(error.output); if (usage !== undefined) await input.onUsage?.(usage); const tokens = reportedClaudeUsage(error.output); if (tokens) await input.onTokenUsage?.(tokens); throw new Error(error.message); }
    if (error instanceof CheckError) throw new Error('Claude output failed schema validation. The idea was not advanced.');
    if (error instanceof Error && /unknown (?:option|argument)|unrecognized (?:option|argument)|unexpected (?:option|argument)/i.test(error.message))
      throw new Error(`Update native Claude Code to the current release; required restricted/safe-mode/structured-output flags are not supported. No permissive fallback is used. ${error.message}`);
    throw error;
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
