import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { buildRestrictedClaudeArgs, parseClaudeEnvelope, reportedClaudeCost, reportedClaudeUsage } from '../../../features/coforge/application/claude-protocol';
import { executionResult, executionSchema, executionSystemPrompt, executionTaskPrompt } from '../../../features/coforge/application/workflow-execution';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { codexWorkflowTools } from '../codex-workflow-tools';
import { captureClaudeResponse } from '../claude-conversation';
import { ProcessFailure, type captureProcess } from '../process';
import type { WorkerFiles } from './files';

const TOOLS = ['coforge_list_files', 'coforge_read_file', 'coforge_search_files', 'coforge_write_file', 'coforge_delete_file'];
/** A private-CWD Claude process receives only five broker tools, never native filesystem/delegation authority. */
export function backgroundClaudeArgs(input: StageInput, configPath: string): string[] {
  if (!input.workflow || !configPath) throw new Error('A captured Build and private broker configuration are required.');
  const step = input.workflow.step;
  const args = buildRestrictedClaudeArgs(input.settings, { access: 'none', model: step.model, effort: step.effort, schema: executionSchema(input),
    systemPrompt: executionSystemPrompt(input) + ' Native file, shell, browser and agent tools are unavailable. Use only the scoped CoForge MCP file tools; the worker owns the actual repository.' });
  // Safe mode also suppresses explicit MCP. Replace it with individual closed customization/tool controls.
  args.splice(args.indexOf('--safe-mode'), 1);
  args[args.indexOf('--mcp-config') + 1] = configPath;
  const denied = args.indexOf('--disallowedTools') + 1;
  args[denied] = args[denied]!.split(',').filter(name => name !== 'mcp__*').join(',') +
    ',Read,Glob,Grep,Edit,Write,Bash,Agent,Task,Read(**/.coforge/**),Edit(**/.coforge/**),Write(**/.coforge/**)';
  args.push('--settings', JSON.stringify({ disableAllHooks: true, autoMemoryEnabled: false, claudeMdExcludes: ['**'], enabledPlugins: {} }),
    '--disable-slash-commands', '--allowedTools', TOOLS.map(tool => 'mcp__coforge__' + tool).join(','));
  return args;
}
export async function runBackgroundClaude(input: StageInput, workspaces: WorkflowWorkspaces, files: WorkerFiles, capture: typeof captureProcess, protectedPaths: readonly string[], onActivity?: () => Promise<void>) {
  const snapshot = input.workflow; if (!snapshot) throw new Error('A captured background Build is required.');
  const lease = await workspaces.acquire({ runId: snapshot.runId, projectId: ideaProjectId(input.idea), attemptId: snapshot.attemptId, access: 'editworktree',
    integration: input.integration, workspaceId: snapshot.workspaceId, signal: input.signal });
  let bridge: Awaited<ReturnType<typeof codexWorkflowTools>> | undefined;
  let raw = ''; let captured = false;
  const changes = async (summary: string) => {
    if (captured) return undefined;
    const increment = await lease.capture(summary); captured = true; await input.onChanges?.(increment ?? null); return increment;
  };
  try {
    if (lease.id) await input.onWorkspace?.(lease.id);
    await files.verifyIdentity();
    const cwd = join(files.directory, 'claude-' + randomUUID()); await mkdir(cwd, { mode: 0o700 });
    bridge = await codexWorkflowTools(input, lease, protectedPaths, onActivity);
    const config = join(cwd, 'broker.json');
    await writeFile(config, JSON.stringify({ mcpServers: { coforge: { type: 'http', url: bridge.url, headers: { Authorization: 'Bearer ' + bridge.token } } } }), { flag: 'wx', mode: 0o600 });
    await files.verifyIdentity();
    const args = backgroundClaudeArgs(input, config); const prompt = executionTaskPrompt(input);
    await input.onConversation?.({ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1] ?? '', prompt }); input.signal?.throwIfAborted();
    raw = await capture(input.integration.claudeBin, args, { cwd, input: prompt, signal: input.signal });
    await bridge.dispose(); bridge.assertBudget();
    const cost = reportedClaudeCost(raw); if (cost !== undefined) await input.onUsage?.(cost);
    const usage = reportedClaudeUsage(raw); if (usage) await input.onTokenUsage?.(usage);
    await captureClaudeResponse(input, raw);
    const result = executionResult(input, parseClaudeEnvelope(raw).output); const increment = await changes(result.summary ?? 'Background Claude Build changes');
    return { ...result, ...(increment ? { increment } : {}), ...(cost === undefined ? {} : { costUsd: cost }), ...(usage ? { usage } : {}) };
  } catch (error) {
    if (error instanceof ProcessFailure) {
      raw = error.output;
      const cost = reportedClaudeCost(raw); if (cost !== undefined) await input.onUsage?.(cost);
      const usage = reportedClaudeUsage(raw); if (usage) await input.onTokenUsage?.(usage);
      await captureClaudeResponse(input, raw);
    }
    await bridge?.dispose(); await changes('Retained changes after interrupted background Claude Build'); throw error;
  } finally { await bridge?.dispose(); await lease.release(); }
}
