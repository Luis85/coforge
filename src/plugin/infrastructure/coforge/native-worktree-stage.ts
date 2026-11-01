import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StageInput, StageResult } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../features/coforge/application/workflow-workspace-ports';
import type { NativeWorkflowProcessRecord, NativeWorkflowPrivateRuntime } from '../../features/coforge/domain/native-workflow-process';
import { nativeCodingProfileCheck } from '../../features/coforge/domain/worktree-coding';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { executionResult, executionSchema, executionSystemPrompt, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { buildNativeClaudeArgs } from '../../features/coforge/application/native-coding-protocol';
import { nativeCodingIncrement } from '../../features/coforge/application/native-coding-increment';
import { parseClaudeEnvelope, reportedClaudeCost, reportedClaudeUsage } from '../../features/coforge/application/claude-protocol';
import { ProviderFailureError, providerFailureFor } from '../../features/coforge/domain/provider-failure';
import { captureProcess, ProcessFailure, ProcessOwnershipUnknown, type ProcessOptions } from './process';
import { createCodexPrivateRuntime, purgeCodexPrivateRuntime } from './codex-private-runtime';
import { runCodexTransport } from './codex-transport';
import { captureObservedClaude } from './claude-observed-capture';
import { captureClaudeResponse } from './claude-conversation';
import { captureProviderFailure, diagnoseProviderFailure, preserveProviderFailure } from './provider-failure';
import { persistProviderEvidence, validateProviderWorkspace } from './provider-evidence';

interface NativeStageOptions { provider: 'claude' | 'codex'; capture?: typeof captureProcess; probe?: typeof captureProcess }
async function qualifyClaude(command: string, cwd: string, probe: typeof captureProcess, signal?: AbortSignal): Promise<{ forwardSubagentText: boolean }> {
  const options = { cwd, signal, timeoutMs: 5000, maxBytes: 64000 };
  try {
    const version = /\b(\d+)\.(\d+)\.(\d+)\b/u.exec(await probe(command, ['--version'], options));
    if (!version || Number(version[1]) < 2 || Number(version[1]) === 2 && (Number(version[2]) < 1 || Number(version[2]) === 1 && Number(version[3]) < 281)) throw new ProviderFailureError(providerFailureFor('capability'));
    const help = await probe(command, ['--help'], options);
    if (['--agents', '--restricted', '--permission-prompts', '--append-system-prompt', '--tools', '--max-budget-usd'].some(flag => !help.includes(flag))) throw new ProviderFailureError(providerFailureFor('capability'));
    return { forwardSubagentText: help.includes('--forward-subagent-text') };
  } catch (error) { throw diagnoseProviderFailure('claude', error, signal); }
}
/** Ordinary native coding is admitted once and remains tied to one owned worktree and independent OS lifetime. */
export async function runNativeWorktreeStage(input: StageInput, workspaces: WorkflowWorkspaces, options: NativeStageOptions): Promise<StageResult> {
  const snapshot = input.workflow;
  if (!snapshot || snapshot.worktreeCoding?.profile !== 'native-worktree-v1' || snapshot.step.provider !== options.provider || snapshot.step.access !== 'editworktree' || snapshot.step.output !== 'codechange'
    || !input.integration.allowImplementation || !input.onWorkspace || !input.onNativeProcess || options.provider === 'codex' && !input.onNativeRuntime)
    throw new ProviderFailureError(providerFailureFor('configuration'));
  const profile = nativeCodingProfileCheck(snapshot.worktreeCoding);
  input.signal?.throwIfAborted();
  const lease = await workspaces.acquire({ runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea), access: 'editworktree', integration: input.integration, workspaceId: snapshot.workspaceId, signal: input.signal });
  let processRecord: NativeWorkflowProcessRecord | undefined, privateRuntime: NativeWorkflowPrivateRuntime | undefined, directory: string | undefined;
  let captured = false, uncertain = false, failed = false; let failure: unknown; let result: StageResult | undefined; let raw = '';
  const fail = (error: unknown) => { failure = failed ? preserveProviderFailure(failure, error) : error; failed = true; uncertain ||= error instanceof ProcessOwnershipUnknown; };
  const observe: NonNullable<ProcessOptions['onOwnedProcess']> = async (identity, phase, lifetime) => {
    const retainedLifetime = lifetime ?? processRecord?.lifetime;
    if (!retainedLifetime && phase !== 'unknown') throw new ProviderFailureError(providerFailureFor('capability'));
    const record = { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea), identity, phase, observedAt: new Date().toISOString(),
      ...(retainedLifetime ? { lifetime: retainedLifetime } : {}), ...(privateRuntime ? { privateRuntime } : {}) };
    processRecord = record; await persistProviderEvidence(() => input.onNativeProcess!(record));
    if (phase === 'unknown') uncertain = true;
  };
  const changes = async (summary: string) => {
    if (captured || lease.readOnly) return;
    await validateProviderWorkspace(() => lease.validate?.());
    const value = await lease.capture(summary); captured = true;
    const increment = value ? nativeCodingIncrement(value) : undefined;
    await persistProviderEvidence(() => input.onChanges?.(increment ?? null));
    return increment;
  };
  try {
    if (!lease.id || lease.readOnly || !lease.validate) throw new ProviderFailureError(providerFailureFor('configuration'));
    await validateProviderWorkspace(() => lease.validate!());
    await persistProviderEvidence(() => input.onWorkspace!(lease.id!));
    const instructions = executionSystemPrompt(input), prompt = executionTaskPrompt(input);
    input.onLog?.('Ordinary native coding in the dedicated worktree; provider permissions apply. Worktree organization is not an OS sandbox.');
    if (options.provider === 'codex') {
      directory = await mkdtemp(join(tmpdir(), 'coforge-codex-'));
      privateRuntime = await createCodexPrivateRuntime(directory, { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea) }); directory = privateRuntime.directory;
      await persistProviderEvidence(() => input.onNativeRuntime!(privateRuntime));
      const response = await runCodexTransport({ directory, cwd: lease.cwd, nativeCoding: profile, privateRuntime, executable: input.integration.codexBin, model: snapshot.step.model, effort: snapshot.step.effort,
        schema: executionSchema(input), instructions, prompt, timeoutMs: snapshot.step.execution ? undefined : input.settings.timeoutSeconds * 1000, signal: input.signal, capture: options.capture,
        onOwnedProcess: observe, onConversation: input.onConversation, onSessionEvent: input.onSessionEvent, telemetry: usage => persistProviderEvidence(() => usage ? input.onTokenUsage?.(usage) : undefined) });
      if (processRecord?.phase !== 'terminated' || uncertain) throw new ProcessOwnershipUnknown('');
      result = { ...executionResult(input, response.output), ...(response.usage ? { usage: response.usage } : {}) };
    } else {
      const command = input.integration.claudeBin.trim() || 'claude';
      if (/\.(?:cmd|bat|ps1)$/iu.test(command)) throw new ProviderFailureError(providerFailureFor('installation'));
      const capabilities = await qualifyClaude(command, lease.cwd, options.probe ?? captureProcess, input.signal);
      const args = buildNativeClaudeArgs(input.settings, { model: snapshot.step.model, effort: snapshot.step.effort, schema: executionSchema(input), instructions, nativeCoding: profile, observeChildren: Boolean(input.onSessionEvent && capabilities.forwardSubagentText) });
      await persistProviderEvidence(() => input.onConversation?.({ kind: 'request', instructions, prompt }));
      raw = await captureObservedClaude(input, command, args, { cwd: lease.cwd, input: prompt, signal: input.signal, timeoutMs: snapshot.step.execution ? undefined : input.settings.timeoutSeconds * 1000,
        ownedTree: true, nativeCoding: { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea) }, onOwnedProcess: observe }, options.capture);
      const cost = reportedClaudeCost(raw); if (cost !== undefined) await persistProviderEvidence(() => input.onUsage?.(cost));
      const usage = reportedClaudeUsage(raw, { delegated: true }); if (usage) await persistProviderEvidence(() => input.onTokenUsage?.(usage));
      await captureClaudeResponse(input, raw);
      if (processRecord?.phase !== 'terminated' || uncertain) throw new ProcessOwnershipUnknown(raw);
      result = { ...executionResult(input, parseClaudeEnvelope(raw).output), ...(cost === undefined ? {} : { costUsd: cost }), ...(usage ? { usage } : {}) };
    }
    const increment = await changes(result.summary ?? 'Native coding worktree changes');
    if (increment) result.increment = increment;
  } catch (error) {
    const diagnosed = diagnoseProviderFailure(options.provider, error, input.signal); fail(diagnosed);
    if (!processRecord && error instanceof ProcessOwnershipUnknown && error.ownership?.identity && error.ownership.lifetime)
      processRecord = { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea), identity: error.ownership.identity, lifetime: error.ownership.lifetime,
        phase: 'unknown', observedAt: new Date().toISOString(), ...(privateRuntime ? { privateRuntime } : {}) };
    if (processRecord && processRecord.phase !== 'terminated') {
      uncertain = true;
      try { const record = { ...processRecord, phase: 'unknown' as const, observedAt: new Date().toISOString() }; await input.onNativeProcess!(record); processRecord = record; } catch { /* Original launch remains retained. */ }
    }
    if (error instanceof ProcessFailure && options.provider === 'claude') {
      const cost = reportedClaudeCost(error.output); if (cost !== undefined) { try { await persistProviderEvidence(() => input.onUsage?.(cost)); } catch (writeError) { fail(writeError); } }
      const usage = reportedClaudeUsage(error.output, { delegated: true }); if (usage) { try { await persistProviderEvidence(() => input.onTokenUsage?.(usage)); } catch (writeError) { fail(writeError); } }
      try { await captureClaudeResponse(input, error.output); } catch (writeError) { fail(writeError); }
    }
    await captureProviderFailure(input.onSessionEvent, failure);
    if (!uncertain) { try { await changes('Retained native coding changes after a failed attempt'); } catch (captureError) { fail(captureError); } }
  }
  if (privateRuntime && !uncertain) {
    try {
      await purgeCodexPrivateRuntime(privateRuntime);
      if (processRecord?.privateRuntime) { const record = { ...processRecord, privateRuntime: undefined, observedAt: new Date().toISOString() }; await persistProviderEvidence(() => input.onNativeProcess!(record)); processRecord = record; }
      await persistProviderEvidence(() => input.onNativeRuntime!(undefined));
    } catch (cleanupError) { uncertain = true; fail(cleanupError); }
  }
  try { await lease.release(uncertain || undefined); } catch (releaseError) { fail(releaseError); }
  if (directory && !uncertain) { try { await rm(directory, { recursive: true, force: true }); } catch (cleanupError) { fail(cleanupError); } }
  if (failed) throw failure;
  if (!result) throw new ProviderFailureError(providerFailureFor('incomplete_output'));
  return result;
}
