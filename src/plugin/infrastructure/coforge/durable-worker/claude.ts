import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StageInput, StageResult } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { parseClaudeEnvelope, reportedClaudeCost, reportedClaudeUsage } from '../../../features/coforge/application/claude-protocol';
import { executionResult, executionTaskPrompt } from '../../../features/coforge/application/workflow-execution';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { codexWorkflowTools } from '../codex-workflow-tools';
import { captureClaudeResponse } from '../claude-conversation';
import { captureProcess, ProcessFailure, ProcessOwnershipUnknown } from '../process';
import type { WorkerFiles } from './files';
import { brokeredClaudeArgs, nativeClaudeDelegation, prepareNativeClaude, usesNativeClaudeTools } from '../claude-native-tools';

/** A private-CWD Claude process receives only five broker tools, never native filesystem/delegation authority. */
export function backgroundClaudeArgs(input: StageInput, configPath: string): string[] {
  return brokeredClaudeArgs(input, configPath);
}
export async function runBackgroundClaude(input: StageInput, workspaces: WorkflowWorkspaces, files: WorkerFiles, capture: typeof captureProcess, protectedPaths: readonly string[], onActivity?: () => Promise<void>, probe: typeof captureProcess = captureProcess) {
  const snapshot = input.workflow; if (!snapshot) throw new Error('A captured background Build is required.');
  const lease = await workspaces.acquire({ runId: snapshot.runId, projectId: ideaProjectId(input.idea), attemptId: snapshot.attemptId, access: 'editworktree',
    integration: input.integration, workspaceId: snapshot.workspaceId, signal: input.signal });
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  let raw = ''; let captured = false; let providerReturned = false; let resultValidated = false; let uncertain = false;
  let outcome: StageResult | undefined; let failed = false; let failure: unknown;
  const fail = (error: unknown) => {
    if (!failed || !(failure instanceof ProcessOwnershipUnknown) || error instanceof ProcessOwnershipUnknown) failure = error;
    failed = true;
  };
  const changes = async (summary: string) => {
    if (captured) return undefined;
    const capturedIncrement = await lease.capture(summary);
    const increment = capturedIncrement && bridge ? await bridge.captureVerification(capturedIncrement) : capturedIncrement;
    captured = true; await input.onChanges?.(increment ?? null); return increment;
  };
  try {
    if (lease.id) await input.onWorkspace?.(lease.id);
    await files.verifyIdentity();
    const cwd = join(files.directory, 'claude-' + randomUUID()); await mkdir(cwd, { mode: 0o700 });
    bridge = await codexWorkflowTools(input, lease, protectedPaths, onActivity);
    const config = join(cwd, 'broker.json');
    await writeFile(config, JSON.stringify({ mcpServers: { coforge: { type: 'http', url: bridge.url, headers: { Authorization: 'Bearer ' + bridge.token } } } }), { flag: 'wx', mode: 0o600 });
    await files.verifyIdentity();
    await prepareNativeClaude(input, config, input.integration.claudeBin, probe);
    const args = backgroundClaudeArgs(input, config); const prompt = executionTaskPrompt(input);
    await input.onConversation?.({ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1] ?? '', prompt }); input.signal?.throwIfAborted();
    raw = await capture(input.integration.claudeBin, args, { cwd, input: prompt, signal: input.signal, ...(usesNativeClaudeTools(input) ? { ownedTree: true as const } : {}) });
    providerReturned = true;
    await bridge.dispose(); bridge.assertBudget();
    const cost = reportedClaudeCost(raw); if (cost !== undefined) await input.onUsage?.(cost);
    const usage = reportedClaudeUsage(raw, { delegated: nativeClaudeDelegation(input) }); if (usage) await input.onTokenUsage?.(usage);
    await captureClaudeResponse(input, raw);
    const result = executionResult(input, parseClaudeEnvelope(raw).output); resultValidated = true;
    const increment = await changes(result.summary ?? 'Background Claude Build changes');
    const verification = bridge.verificationRecords();
    outcome = { ...result, ...(increment ? { increment } : {}), ...(verification.length ? { verification } : {}), ...(cost === undefined ? {} : { costUsd: cost }), ...(usage ? { usage } : {}) };
  } catch (caught) {
    uncertain = caught instanceof ProcessOwnershipUnknown || usesNativeClaudeTools(input) && providerReturned && !resultValidated;
    if (caught instanceof ProcessFailure) raw = caught.output;
    fail(uncertain && !(caught instanceof ProcessOwnershipUnknown) ? new ProcessOwnershipUnknown(raw) : caught);
    try {
      if (caught instanceof ProcessFailure) {
        const cost = reportedClaudeCost(raw); if (cost !== undefined) await input.onUsage?.(cost);
        const usage = reportedClaudeUsage(raw, { delegated: nativeClaudeDelegation(input) }); if (usage) await input.onTokenUsage?.(usage);
        await captureClaudeResponse(input, raw);
      }
    } catch (evidenceError) { fail(evidenceError); }
    try { await bridge?.dispose(); } catch (cleanupError) { uncertain = true; fail(cleanupError); }
    try { await changes('Retained changes after interrupted background Claude Build'); } catch (captureError) { fail(captureError); }
  }
  try { await bridge?.dispose(); } catch (cleanupError) { uncertain = true; fail(cleanupError); }
  try { await lease.release(uncertain || undefined); } catch (releaseError) { fail(releaseError); }
  if (failed) throw failure;
  if (!outcome) throw new Error('Background Claude completed without a validated result.');
  return outcome;
}
