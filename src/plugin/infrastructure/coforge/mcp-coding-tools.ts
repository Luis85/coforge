import type { McpTool } from './mcp-server';

const id = { type: 'string', minLength: 1, maxLength: 160 };
const path = { type: 'string', minLength: 1, maxLength: 1000 };
function tool(name: string, description: string, properties: Record<string, object>, required: string[], readOnly: boolean): McpTool {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: !readOnly } };
}
/** Capabilities are advertised globally but authorized against the captured task on every effect. */
export function mcpCodingTools(): McpTool[] {
  return [
    tool('coforge_run_command', 'Run a coding/test/build or internet-research command in this authorized task’s dedicated worktree under the desktop account. Normal desktop networking permits documentation fetches and dependency installation. No Docker or command allowlist is required. A worktree is not an OS sandbox. Use a stable idempotencyKey after an uncertain response; a new key intentionally starts another command. Long commands return an ID for polling. Exit zero is process completion, not an acceptance/test verdict.',
      { taskId: id, command: { type: 'string', minLength: 1, maxLength: 16000 }, idempotencyKey: id, label: { type: 'string', minLength: 1, maxLength: 120 },
        timeoutSeconds: { type: 'integer', minimum: 1, maximum: 86400 }, yieldTimeMs: { type: 'integer', minimum: 0, maximum: 5000 } }, ['taskId', 'command', 'idempotencyKey'], false),
    tool('coforge_command_status', 'Read this project/task command’s actual state and exit code. Status polling omits repeated output by default; set includeOutput=true to inspect the bounded recent sanitized log. Poll the command ID, never replay run_command merely to poll. Unknown outcomes are not success.',
      { taskId: id, commandId: id, includeOutput: { type: 'boolean' } }, ['taskId', 'commandId'], true),
    tool('coforge_commands', 'Discover retained commands for this project/task after reconnect without starting anything. Compact newest-first metadata omits logs; use command_status to read one command. onlyActive includes unknown outcomes requiring recovery.',
      { taskId: id, offset: { type: 'integer', minimum: 0, maximum: 100000 }, limit: { type: 'integer', minimum: 1, maximum: 100 }, onlyActive: { type: 'boolean' } }, ['taskId'], true),
    tool('coforge_cancel_command', 'Stop only the original owned command and its descendants for this active coding task. This is not a task retry or permission to release an unknown workspace.',
      { taskId: id, commandId: id }, ['taskId', 'commandId'], false),
    tool('coforge_inspect_changes', 'Inspect host-captured changes in this task’s worktree, without committing, publishing or accepting them. Default returns file counts and identity; request a bounded diff when needed.',
      { taskId: id, includeDiff: { type: 'boolean' }, maxCharacters: { type: 'integer', minimum: 100, maximum: 200000 } }, ['taskId'], true),
    tool('coforge_apply_patch', 'Apply atomic literal replacements to one UTF-8 file against its exact SHA-256. Each oldText must occur exactly once. All replacements validate before any write. Read the file again after a conflict.',
      { taskId: id, path, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, edits: { type: 'array', minItems: 1, maxItems: 100, items: {
        type: 'object', properties: { oldText: { type: 'string', minLength: 1, maxLength: 200000 }, newText: { type: 'string', maxLength: 200000 } }, required: ['oldText', 'newText'], additionalProperties: false } } }, ['taskId', 'path', 'expectedSha256', 'edits'], false),
    tool('coforge_move_file', 'Rename one regular file inside the coding worktree against its SHA-256. The destination must not exist; protected paths and links are rejected.',
      { taskId: id, path, destination: path, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, ['taskId', 'path', 'destination', 'expectedSha256'], false),
    tool('coforge_read_artifact', 'Inspect a bounded generated text or PNG/JPEG/WebP artifact in this task’s worktree. Paths stay repository-relative; credentials, links and managed/private transport data are excluded.',
      { taskId: id, path }, ['taskId', 'path'], true),
  ];
}
