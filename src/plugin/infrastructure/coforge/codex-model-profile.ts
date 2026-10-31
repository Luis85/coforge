import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { record } from '../../features/coforge/domain/check';

/** Restrict a cached model's advertised client capabilities without changing model identity. */
export function restrictedCodexModel(model: string, cache: unknown): object {
  const models = record(cache).models;
  if (!Array.isArray(models)) throw new Error('Codex model metadata is unavailable. Open Codex once to refresh its model catalogue.');
  const source = models.map(item => record(item)).find(item => item.slug === model);
  if (!source) throw new Error('This model is not in the local Codex catalogue. Open Codex to refresh available models, then select an available model.');
  const metadata = { ...source };
  delete metadata.model_messages;
  return { models: [{ ...metadata, input_modalities: ['text'], apply_patch_tool_type: null,
    experimental_supported_tools: [], node_repl_disabled: true, supports_parallel_tool_calls: false,
    tool_mode: 'direct', use_responses_lite: false, supports_search_tool: false,
    multi_agent_version: null,
    include_skills_usage_instructions: false, include_plugin_usage_instructions: false, include_apps_usage_instructions: false,
    base_instructions: 'You are a CoForge task worker. Use only the invocation-scoped CoForge MCP tools and return the requested structured result. Do not request native file, shell, image, browser or delegation tools.' }] };
}
export async function writeCodexModelProfile(directory: string, model: string): Promise<string> {
  let cache: unknown;
  try { cache = JSON.parse(await readFile(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'models_cache.json'), 'utf8')); }
  catch { throw new Error('Codex model metadata is unavailable. Open Codex once to refresh its model catalogue.'); }
  const path = join(directory, 'model-profile.json');
  await writeFile(path, JSON.stringify(restrictedCodexModel(model, cache)), { flag: 'wx', mode: 0o600 });
  return path;
}
