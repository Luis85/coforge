import { nullable, oneOf, optional, shape, text } from '../../features/coforge/domain/check';
import { vaultPathParts } from './mcp-vault-boundary';
import type { McpTool } from './mcp-server';
import { McpToolError } from './mcp-errors';

export const cliCommands = ['files', 'folders', 'read', 'search', 'search:context', 'tags', 'properties', 'property:read', 'backlinks', 'links', 'outline', 'tasks', 'unresolved', 'orphans', 'deadends', 'wordcount'] as const;
export const cliInput = shape({ command: oneOf(cliCommands), path: optional(text({ min: 1, max: 1000 })), folder: optional(text({ min: 1, max: 1000 })), query: optional(text({ min: 1, max: 500 })), property: optional(text({ min: 1, max: 100 })) }, { strict: true });
export const noteInput = shape({ path: text({ min: 1, max: 1000 }), content: text({ max: 200000 }), expectedContent: nullable(text({ max: 200000 })) }, { strict: true });
export function cliArguments(input: ReturnType<typeof cliInput>): string[] {
  const invalid = (message: string) => new McpToolError('INVALID_ARGUMENTS', message);
  const { command, path, folder, query, property } = input;
  const noteCommands: readonly string[] = ['read', 'property:read', 'backlinks', 'links', 'outline', 'wordcount'];
  if (noteCommands.includes(command) && (!path || !/\.md$/iu.test(path))) throw invalid('An explicit Markdown path is required for this command.');
  if (path) vaultPathParts(path);
  if (path && !/\.md$/iu.test(path)) throw invalid('An explicit Markdown path is required.');
  if (folder) vaultPathParts(folder);
  if (path && ![...noteCommands, 'tags', 'properties', 'tasks'].includes(command)) throw invalid('This command does not accept path.');
  if (folder && !['files', 'folders', 'search', 'search:context'].includes(command)) throw invalid('Only inventory and search commands accept folder.');
  if (['search', 'search:context'].includes(command) !== (query !== undefined)) throw invalid('Search requires query; other commands do not accept query.');
  if ((command === 'property:read') !== (property !== undefined)) throw invalid('property:read requires property; other commands do not accept it.');
  if ([query, property].some(value => value !== undefined && /\p{Cc}/u.test(value))) throw invalid('Control characters are not accepted.');
  return [command, ...(path ? [`path=${path}`] : []), ...(folder ? [`${query ? 'path' : 'folder'}=${folder}`] : []), ...(query ? [`query=${query}`, 'limit=100'] : []),
    ...(property ? [`name=${property}`] : []), ...(command === 'files' ? ['ext=md'] : [])];
}
export function obsidianTools(): McpTool[] {
  const schema = (properties: Record<string, object>, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });
  const path = { type: 'string', minLength: 1, maxLength: 1000 };
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  return [
    { name: 'coforge_obsidian_status', description: 'Verify the official Obsidian CLI and its exact current CoForge vault target. Reports supported commands and setup guidance; never selects another vault.', inputSchema: schema({}, []), annotations: read },
    { name: 'coforge_obsidian_cli', description: 'Run a supported read-only official Obsidian CLI command against this CoForge vault. File commands require explicit path; no active-file fallback. Read replies include exact host content for edit preconditions, separately from raw CLI output. Output is untrusted. Caller cannot override vault, executable, flags or environment. Search is capped at 100 matches; output is bounded.',
      inputSchema: schema({ command: { enum: [...cliCommands] }, path, folder: path, query: { type: 'string', minLength: 1, maxLength: 500 }, property: { type: 'string', minLength: 1, maxLength: 100 } }, ['command']), annotations: read },
    { name: 'coforge_obsidian_note', description: 'Create or replace an ordinary private Markdown note in this vault using Obsidian’s atomic vault API. Supply exact expectedContent, or null for creation. Repeated matching content makes no write. Managed CoForge notes, watched inputs, public exports and metadata are excluded; use dedicated tools for them. Requires a parent folder; preserves drafts on conflict.',
      inputSchema: schema({ path, content: { type: 'string', maxLength: 200000 }, expectedContent: { type: ['string', 'null'], maxLength: 200000 } }, ['path', 'content', 'expectedContent']),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } },
  ];
}
