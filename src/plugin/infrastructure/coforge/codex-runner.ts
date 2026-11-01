import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StageInput, StageResult } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess, executionResult, executionSchema, executionSystemPrompt, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { codexWorkflowTools } from './codex-workflow-tools';
import { runCodexTransport } from './codex-transport';
import { ProcessOwnershipUnknown, type captureProcess } from './process';
import { validateNativeWorkflowTools } from '../../features/coforge/domain/native-workflow-tools';
import type { NativeWorkflowPrivateRuntime, NativeWorkflowProcessRecord } from '../../features/coforge/domain/native-workflow-process';
import { createCodexPrivateRuntime, purgeCodexPrivateRuntime } from './codex-private-runtime';
import { captureProviderFailure, diagnoseProviderFailure, preserveProviderFailure } from './provider-failure';
import { CheckError } from '../../features/coforge/domain/check';

export async function runCodexStage(input: StageInput, workspaces: WorkflowWorkspaces, capture?: typeof captureProcess, protectedPaths?: readonly string[], onActivity?: () => Promise<void>): Promise<StageResult> {
  if (!input.workflow) throw new Error('Codex requires a captured workflow. Save and start the project workflow before dispatching.');
  input.signal?.throwIfAborted();
  const snapshot = input.workflow;
  validateNativeWorkflowTools(snapshot.step, 'codex');
  if (snapshot.step.nativeTools && !input.onNativeRuntime) throw new Error('Native Codex requires retained private runtime preparation before native state can be created.');
  if (snapshot.step.nativeTools && !capture && !input.onNativeProcess) throw new Error('Native Codex tools require durable foreground process ownership before provider start. Open the contained desktop host or use the admitted background worker.');
  const lease = await workspaces.acquire({ runId: snapshot.runId, projectId: ideaProjectId(input.idea), attemptId: snapshot.attemptId, access: executionAccess(input), integration: input.integration, workspaceId: snapshot.workspaceId, signal: input.signal });
  let directory: string | undefined;
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  let captured = false;
  let uncertain = false;
  let nativeProcess: NativeWorkflowProcessRecord | undefined;
  let privateRuntime: NativeWorkflowPrivateRuntime | undefined;
  let outcome: StageResult | undefined;
  let failed = false; let failure: unknown;
  const fail = (error: unknown, prefer = false) => {
    if (!failed || error instanceof ProcessOwnershipUnknown || prefer && !(failure instanceof ProcessOwnershipUnknown)) failure = failed ? preserveProviderFailure(failure, error) : error;
    failed = true;
  };
  const observeNative: NonNullable<StageInput['onNativeProcess']> = async record => {
    nativeProcess = record; await input.onNativeProcess?.(record);
  };
  const markUnknown = async () => {
    uncertain = true;
    if (nativeProcess && nativeProcess.phase !== 'terminated') {
      try { await observeNative({ ...nativeProcess, phase: 'unknown', observedAt: new Date().toISOString() }); } catch { /* Retained launch evidence keeps admission blocked. */ }
    }
  };
  const drain = async () => {
    try { await bridge?.dispose(); }
    catch (error) { await markUnknown(); throw error; }
  };
  const changes = async (summary: string) => {
    if (captured || lease.readOnly) return;
    const raw = await lease.capture(summary); captured = true;
    const increment = raw && bridge ? await bridge.captureVerification(raw) : raw;
    if (lease.id) await input.onChanges?.(increment ?? null);
    return increment;
  };
  try {
    if (lease.id) await input.onWorkspace?.(lease.id);
    directory = await mkdtemp(join(tmpdir(), 'coforge-codex-'));
    if (snapshot.step.nativeTools) {
      privateRuntime = await createCodexPrivateRuntime(directory, { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea) });
      directory = privateRuntime.directory;
      await input.onNativeRuntime!(privateRuntime);
    }
    bridge = await codexWorkflowTools(input, lease, protectedPaths ?? lease.protectedProjectPaths ?? [], onActivity);
    input.onLog?.(`Codex ${snapshot.step.name}: scoped CoForge tools; native project access is disabled. Claude USD/turn caps are not Codex spending limits.`);
    const response = await runCodexTransport({ directory, executable: input.integration.codexBin, model: snapshot.step.model, effort: snapshot.step.effort,
      schema: executionSchema(input), instructions: executionSystemPrompt(input), prompt: executionTaskPrompt(input), timeoutMs: input.settings.timeoutSeconds * 1000,
      signal: input.signal, mcp: bridge, nativeTools: snapshot.step.nativeTools, privateRuntime, capture, onConversation: input.onConversation, onSessionEvent: input.onSessionEvent, telemetry: async usage => { if (usage) await input.onTokenUsage?.(usage); },
      onOwnedProcess: async (identity, phase) => observeNative({ runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: ideaProjectId(input.idea), identity, phase, observedAt: new Date().toISOString(), ...(privateRuntime ? { privateRuntime } : {}) }) });
    await drain();
    bridge.assertBudget();
    const result = executionResult(input, response.output);
    if (nativeProcess) await observeNative({ ...nativeProcess, phase: 'terminated', observedAt: new Date().toISOString() });
    const increment = await changes(result.summary ?? `Cumulative changes after ${snapshot.step.name}`);
    const verification = bridge.verificationRecords();
    outcome = { ...result, ...(increment ? { increment } : {}), ...(verification.length ? { verification } : {}), ...(response.usage ? { usage: response.usage } : {}) };
  } catch (error) {
    const diagnosed = error instanceof CheckError ? diagnoseProviderFailure('codex', error) : error;
    fail(diagnosed); uncertain ||= error instanceof ProcessOwnershipUnknown;
    if (error instanceof CheckError) await captureProviderFailure(input.onSessionEvent, diagnosed);
    try { await drain(); } catch (cleanupError) { fail(cleanupError, true); }
    if (nativeProcess && nativeProcess.phase !== 'terminated') await markUnknown();
    try { await changes(`Cumulative changes after failed ${snapshot.step.name}`); } catch (captureError) { fail(captureError); }
  }
  try { await drain(); } catch (cleanupError) { fail(cleanupError, true); }
  if (privateRuntime && !uncertain) {
    try {
      await purgeCodexPrivateRuntime(privateRuntime);
      if (nativeProcess?.privateRuntime) await observeNative({ ...nativeProcess, privateRuntime: undefined, observedAt: new Date().toISOString() });
      await input.onNativeRuntime!(undefined); privateRuntime = undefined;
    } catch (cleanupError) { await markUnknown(); fail(cleanupError, true); }
  }
  try { await lease.release(uncertain || undefined); } catch (releaseError) { fail(releaseError); }
  if (directory && !uncertain) { try { await rm(directory, { recursive: true, force: true }); } catch (cleanupError) { fail(cleanupError); } }
  if (failed) throw failure;
  if (!outcome) throw new Error('Codex did not produce a validated workflow result.');
  return outcome;
}
