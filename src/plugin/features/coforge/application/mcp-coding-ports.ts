import type { StageInput } from './ports';
import type { WorkflowWorkspaceLease } from './workflow-workspace-ports';
import type { ProviderFailureInfo } from '../domain/provider-failure';

export interface McpCommandRequest { command: string; idempotencyKey: string; label?: string; timeoutSeconds?: number; yieldTimeMs?: number }
export interface McpCommandOutcome {
  id: string; projectId: string; taskId: string; runId: string; attemptId: string;
  label: string; status: 'starting' | 'running' | 'completed' | 'failed' | 'interrupted' | 'unknown';
  commandDisplay?: string; commandDigest?: string;
  failure?: ProviderFailureInfo;
  startedAt: string; finishedAt?: string; exitCode?: number; output: string; truncated: boolean;
  /** Exit zero establishes process completion, not a test verdict or unchanged source. */
  source: 'host-worktree-command';
}
export interface McpCodingCommands {
  describe?(): { platform: string; shell: string; managedCommandsSupported: boolean };
  list(projectId: string, taskId: string, query: { offset?: number; limit?: number; onlyActive?: boolean }): Promise<{ commands: McpCommandOutcome[]; total: number; nextOffset?: number }>;
  start(input: StageInput, lease: WorkflowWorkspaceLease, request: McpCommandRequest, validate: () => void): Promise<McpCommandOutcome>;
  status(projectId: string, taskId: string, commandId: string): Promise<McpCommandOutcome>;
  cancel(projectId: string, taskId: string, commandId: string): Promise<McpCommandOutcome>;
  /** Stop owned servers/tests and prove quiescence before the caller captures/releases its lease. */
  settle(input: StageInput): Promise<{ quiescent: boolean; commands: McpCommandOutcome[] }>;
  recover(projectId: string, taskId: string): Promise<{ quiescent: boolean; commands: McpCommandOutcome[] }>;
}
export const MCP_CODING_TOOLS = ['coforge_run_command', 'coforge_commands', 'coforge_command_status', 'coforge_cancel_command', 'coforge_inspect_changes', 'coforge_apply_patch', 'coforge_move_file', 'coforge_read_artifact'] as const;
