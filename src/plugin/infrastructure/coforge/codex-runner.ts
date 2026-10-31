import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StageInput, StageResult } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../features/coforge/application/workflow-workspace-ports';
import { executionAccess, executionResult, executionSchema, executionSystemPrompt, executionTaskPrompt } from '../../features/coforge/application/workflow-execution';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { codexWorkflowTools } from './codex-workflow-tools';
import { runCodexTransport } from './codex-transport';

export async function runCodexStage(input: StageInput, workspaces: WorkflowWorkspaces): Promise<StageResult> {
  if (!input.workflow) throw new Error('Codex requires a captured workflow. Save and start the project workflow before dispatching.');
  input.signal?.throwIfAborted();
  const snapshot = input.workflow;
  const lease = await workspaces.acquire({ runId: snapshot.runId, projectId: ideaProjectId(input.idea), attemptId: snapshot.attemptId, access: executionAccess(input), integration: input.integration, workspaceId: snapshot.workspaceId, signal: input.signal });
  let directory: string | undefined;
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  let captured = false;
  const changes = async (summary: string) => {
    if (captured) return;
    const increment = await lease.capture(summary); captured = true;
    if (lease.id) await input.onChanges?.(increment ?? null);
    return increment;
  };
  try {
    if (lease.id) await input.onWorkspace?.(lease.id);
    directory = await mkdtemp(join(tmpdir(), 'coforge-codex-'));
    bridge = await codexWorkflowTools(input, lease);
    input.onLog?.(`Codex ${snapshot.step.name}: scoped CoForge tools; native project access is disabled. Claude USD/turn caps are not Codex spending limits.`);
    const response = await runCodexTransport({ directory, executable: input.integration.codexBin, model: snapshot.step.model, effort: snapshot.step.effort,
      schema: executionSchema(input), instructions: executionSystemPrompt(input), prompt: executionTaskPrompt(input), timeoutMs: input.settings.timeoutSeconds * 1000,
      signal: input.signal, mcp: bridge, onConversation: input.onConversation, telemetry: async usage => { if (usage) await input.onTokenUsage?.(usage); } });
    await bridge.dispose();
    bridge.assertBudget();
    const result = executionResult(input, response.output);
    const increment = await changes(result.summary ?? `Cumulative changes after ${snapshot.step.name}`);
    return { ...result, ...(increment ? { increment } : {}), ...(response.usage ? { usage: response.usage } : {}) };
  } catch (error) {
    await bridge?.dispose();
    await changes(`Cumulative changes after failed ${snapshot.step.name}`);
    throw error;
  } finally {
    await bridge?.dispose();
    await lease.release();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
