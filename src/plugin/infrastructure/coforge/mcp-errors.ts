/** Only deliberate, content-free boundary failures are exposed to clients. Native causes remain private. */
export class McpToolError extends Error {
  constructor(readonly code: 'PERMISSION_DENIED' | 'INVALID_ARGUMENTS' | 'CONFLICT' | 'TASK_NOT_READY' | 'INVALID_RESULT' | 'HOST_UNAVAILABLE',
    message: string, readonly nextTool?: string, readonly retryAfterMs?: number) { super(message); this.name = 'McpToolError'; }
}
