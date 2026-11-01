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
import { captureProcess, ProcessFailure, ProcessOwnershipUnknown } from './process';
import { captureIncrement, prepareWorktree, projectRoot } from './agent-worktree';
import type { WorkflowWorkspaceLease, WorkflowWorkspaces } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess, executionResult, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { captureClaudeResponse } from './claude-conversation';
import { captureBrokeredClaudeRead, hasBrokeredReadScope } from './claude-brokered-reader';
import { nativeClaudeDelegation, usesNativeClaudeTools } from './claude-native-tools';
import { openBrokeredClaude } from './claude-brokered-invocation';
import { captureObservedClaude } from './claude-observed-capture';
import { captureProviderFailure, diagnoseProviderFailure, preserveProviderFailure } from './provider-failure';
import { providerFailureInfo } from '../../features/coforge/domain/provider-failure';
import { assignProviderFailure, providerFailureFor } from '../../features/coforge/domain/provider-failure';
import { persistProviderEvidence } from './provider-evidence';

function executable(integration: IntegrationSettings): string {
  const command = integration.claudeBin.trim() || 'claude';
  if (/\.(cmd|bat)$/i.test(command)) throw assignProviderFailure(new Error('Set the Claude executable to the native claude.exe, not a .cmd/.bat shim. Shell execution is disabled.'), providerFailureFor('installation'));
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

function stageFailure(error: unknown): unknown {
  if (providerFailureInfo(error)) return error;
  if (error instanceof ProcessOwnershipUnknown) return diagnoseProviderFailure('claude', error);
  if (error instanceof ProcessFailure) return diagnoseProviderFailure('claude', error);
  if (error instanceof CheckError) return diagnoseProviderFailure('claude', error);
  if (error instanceof Error && /unknown (?:option|argument)|unrecognized (?:option|argument)|unexpected (?:option|argument)/i.test(error.message))
    return new Error(`Update native Claude Code to the current release; required restricted/safe-mode/structured-output flags are not supported. No permissive fallback is used. ${error.message}`);
  return error;
}

/** Runs one stage through the native Claude Code CLI with stage-specific tool restrictions. */
export async function runClaudeStage(input: StageInput, workspaces?: WorkflowWorkspaces, capture: typeof captureProcess = captureProcess): Promise<StageResult> {
  const { stage, idea, settings, integration, signal } = input;
  const onLog = input.onLog ?? (() => undefined);
  if (signal?.aborted) throw new Error('Run cancelled.');
  let cwd: string; let temporary: string | undefined; let worktree: { cwd: string; branch: string; pointer: Buffer } | null = null;
  let lease: WorkflowWorkspaceLease | undefined;
  let brokered: Awaited<ReturnType<typeof openBrokeredClaude>> | undefined;
  let uncertain = false;
  let captured = false;
  let outcome: StageResult | undefined; let failed = false; let failure: unknown;
  const fail = (error: unknown) => {
    failure = failed ? preserveProviderFailure(failure, error) : error;
    failed = true;
  };
  const changes = async (summary: string) => {
    if (!lease || captured || (usesNativeClaudeTools(input) || brokered ? lease.readOnly : hasBrokeredReadScope(lease))) return undefined;
    const capturedIncrement = await lease.capture(summary);
    const increment = capturedIncrement && brokered ? await brokered.bridge.captureVerification(capturedIncrement) : capturedIncrement;
    captured = true;
    if (lease.id) await persistProviderEvidence(() => input.onChanges?.(increment ?? null));
    return increment;
  };
  if (input.workflow) {
    if (!workspaces) throw new Error('Configured workflow workspaces are unavailable. Restore their private journal before running.');
    lease = await workspaces.acquire({ runId: input.workflow.runId, projectId: ideaProjectId(idea), attemptId: input.workflow.attemptId,
      access: executionAccess(input), integration, ...(input.workflow.workspaceId ? { workspaceId: input.workflow.workspaceId } : {}), ...(signal ? { signal } : {}) });
    cwd = lease.cwd;
    try { if (lease.id && !usesNativeClaudeTools(input) && !hasBrokeredReadScope(lease)) await persistProviderEvidence(() => input.onWorkspace?.(lease!.id!)); }
    catch (error) { await lease.release(); throw error; }
  } else if (stage === 'screen' || stage === 'score') cwd = temporary = await mkdtemp(join(tmpdir(), 'coforge-classifier-'));
  else {
    cwd = await projectRoot(integration);
    if (stage === 'implement') { worktree = await prepareWorktree(input, cwd, onLog); cwd = worktree.cwd; }
  }
  try {
    let raw: string;
    if (lease && (usesNativeClaudeTools(input) || executionAccess(input) === 'editworktree' && lease.protectedProjectPaths !== undefined)) {
      brokered = await openBrokeredClaude(input, lease, executable(integration), capture);
      raw = await brokered.run();
    } else if (lease && hasBrokeredReadScope(lease)) raw = await captureBrokeredClaudeRead(input, lease, executable(integration), capture);
    else {
      const access = executionAccess(input);
      onLog(`Claude ${input.workflow?.step.name ?? stage}: ${access === 'none' ? 'no tools; isolated temporary directory' : access === 'readproject' ? 'read-only project access' : 'file editing in an isolated worktree'}.`);
      const args = buildClaudeArgs(stage, settings, input.workflow);
      const prompt = input.workflow ? executionTaskPrompt(input) : stageInput(stage, idea, settings);
      await persistProviderEvidence(() => input.onConversation?.({ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1] ?? '', prompt }));
      signal?.throwIfAborted();
      raw = await captureObservedClaude(input, executable(integration), args, {
        cwd, input: prompt, timeoutMs: settings.timeoutSeconds * 1000, ...(signal ? { signal } : {}),
      }, capture);
    }
    const usage = reportedClaudeCost(raw); if (usage !== undefined) await persistProviderEvidence(() => input.onUsage?.(usage));
    const tokens = reportedClaudeUsage(raw, { delegated: nativeClaudeDelegation(input) }); if (tokens) await persistProviderEvidence(() => input.onTokenUsage?.(tokens));
    await captureClaudeResponse(input, raw);
    const envelope = parseClaudeEnvelope(raw);
    // Model output is saved to notes and shown to viewers: it gets the same sanitizing as chat before validation.
    const result = input.workflow ? executionResult(input, envelope.output) : await interpret(input, cleanDeep(envelope.output), envelope.costUsd, worktree, onLog);
    await brokered?.complete();
    const increment = await changes(result.summary ?? `Cumulative changes after ${input.workflow?.step.name ?? stage}`);
    if (increment) result.increment = increment;
    if (envelope.costUsd !== undefined) result.costUsd = envelope.costUsd;
    const verification = brokered?.bridge.verificationRecords() ?? [];
    outcome = { ...result, ...(tokens ? { usage: tokens } : {}), ...(verification.length ? { verification } : {}) };
  } catch (error) {
    uncertain = error instanceof ProcessOwnershipUnknown;
    fail(stageFailure(error));
    if (!(error instanceof ProcessFailure)) await captureProviderFailure(input.onSessionEvent, failure);
    try {
      if (error instanceof ProcessFailure) {
        const usage = reportedClaudeCost(error.output); if (usage !== undefined) await persistProviderEvidence(() => input.onUsage?.(usage));
        const tokens = reportedClaudeUsage(error.output, { delegated: nativeClaudeDelegation(input) }); if (tokens) await persistProviderEvidence(() => input.onTokenUsage?.(tokens));
        await captureClaudeResponse(input, error.output);
      }
    } catch (evidenceError) { fail(evidenceError); }
    try { await brokered?.bridge.dispose(); } catch (cleanupError) { uncertain = true; fail(cleanupError); }
    try { await changes(`Cumulative changes after failed ${input.workflow?.step.name ?? stage}`); } catch (captureError) { fail(captureError); }
  }
  // Settle every owned resource before propagating either the result or the strongest failure.
  try { await brokered?.dispose(); } catch (cleanupError) { uncertain = true; fail(cleanupError); }
  try { await lease?.release(uncertain || brokered?.uncertain() || undefined); } catch (releaseError) { fail(releaseError); }
  if (temporary) { try { await rm(temporary, { recursive: true, force: true }); } catch (cleanupError) { fail(cleanupError); } }
  if (failed) throw failure;
  if (!outcome) throw new Error('Claude completed without a validated result. The idea was not advanced.');
  return outcome;
}
