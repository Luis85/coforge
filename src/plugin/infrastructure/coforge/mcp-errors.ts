import { CheckError } from '../../features/coforge/domain/check';
import { providerFailureInfo, providerFailureMessage } from '../../features/coforge/domain/provider-failure';

/** Only deliberate, content-free boundary failures are exposed to clients. Native causes remain private. */
export class McpToolError extends Error {
  constructor(readonly code: 'PERMISSION_DENIED' | 'INVALID_ARGUMENTS' | 'CONFLICT' | 'TASK_NOT_READY' | 'INVALID_RESULT' | 'HOST_UNAVAILABLE',
    message: string, readonly nextTool?: string, readonly retryAfterMs?: number) { super(message); this.name = 'McpToolError'; }
}

/** Keeps tool failures actionable without publishing native causes, paths or request contents. */
export function safeMcpToolFailure(error: unknown, providerNextTool?: string): McpToolError {
  if (error instanceof McpToolError) return error;
  if (error instanceof CheckError) return new McpToolError('INVALID_ARGUMENTS', 'Arguments do not match this tool’s input schema. Inspect tools/list and correct the request.');
  const failure = providerFailureInfo(error);
  if (failure) return new McpToolError('HOST_UNAVAILABLE', providerFailureMessage(failure), providerNextTool);
  return new McpToolError('HOST_UNAVAILABLE', 'CoForge could not confirm this tool call’s outcome. Inspect the retained task and current state before repeating a change.');
}
