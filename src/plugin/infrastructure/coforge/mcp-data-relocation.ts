import { join, resolve } from 'node:path';
import type { McpRegistrationEntry } from './mcp-registration';

/** Editable vault evidence cannot authorize startup writes to arbitrary client settings. */
export function assertOwnedMcpRelocation(
  saved: { paths: readonly string[]; entry: McpRegistrationEntry },
  vault: string, legacyDirectory: string, userSettings: string,
): void {
  const key = (path: string) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  const samePaths = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((path, index) => key(path) === key(right[index]!));
  if (saved.entry.command !== 'node' || !samePaths(saved.paths, [join(vault, '.mcp.json'), userSettings]) ||
    !samePaths(saved.entry.args, [join(legacyDirectory, 'coforge-mcp-bridge.cjs'), join(legacyDirectory, 'coforge-mcp-connection.json')]))
    throw new Error('MCP data relocation needs recovery. Its captured paths do not match this vault and the current client settings; no client configuration was changed.');
}
