import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { record } from '../../features/coforge/domain/check';
import { nativeWorkflowToolsCheck, type NativeWorkflowTools } from '../../features/coforge/domain/native-workflow-tools';
import type { NativeCodingProfile } from '../../features/coforge/domain/worktree-coding';

/** Ordinary coding retains the selected SDK model's native tools and coding instructions. No model substitution. */
export function nativeCodingCodexModel(model: string, cache: unknown): object {
  const models = record(cache).models;
  if (!Array.isArray(models)) throw new Error('Codex model metadata is unavailable.');
  const source = models.map(item => record(item)).find(item => item.slug === model);
  if (!source) throw new Error('The selected native coding model is not advertised by this runtime.');
  if (source.multi_agent_version !== 'v2') throw new Error('The selected native coding model does not advertise bounded native v2 assistants.');
  return { models: [{ ...source }] };
}

/** Restrict a cached model's advertised client capabilities without changing model identity. */
export function restrictedCodexModel(model: string, cache: unknown, nativeTools?: NativeWorkflowTools): object {
  const models = record(cache).models;
  if (!Array.isArray(models)) throw new Error('Codex model metadata is unavailable. Open Codex once to refresh its model catalogue.');
  const source = models.map(item => record(item)).find(item => item.slug === model);
  if (!source) throw new Error('This model is not in the local Codex catalogue. Open Codex to refresh available models, then select an available model.');
  const delegation = nativeTools ? nativeWorkflowToolsCheck(nativeTools).delegation : undefined;
  if (delegation && source.multi_agent_version !== 'v2') throw new Error('This selected Codex model does not advertise native v2 delegation. Refresh the local catalogue or select a supported model.');
  const metadata = { ...source };
  delete metadata.model_messages;
  return { models: [{ ...metadata, input_modalities: ['text'], apply_patch_tool_type: null,
    experimental_supported_tools: [], node_repl_disabled: true, supports_parallel_tool_calls: false,
    tool_mode: 'direct', use_responses_lite: false, supports_search_tool: false,
    multi_agent_version: delegation ? 'v2' : null,
    include_skills_usage_instructions: false, include_plugin_usage_instructions: false, include_apps_usage_instructions: false,
    base_instructions: 'You are a CoForge task worker. Use only the invocation-scoped CoForge MCP tools and return the requested structured result. Do not request native file, shell, image or browser tools. ' +
      (delegation ? 'You may use provider-native subagents within the captured concurrency limit. All descendants share this invocation\'s restricted tools, model and human review boundary. Coordinate and finish their work before returning the root result.' : 'Do not request delegation tools.') }] };
}
export async function writeCodexModelProfile(directory: string, model: string, nativeTools?: NativeWorkflowTools, nativeCatalogue?: unknown, nativeCoding?: NativeCodingProfile): Promise<string> {
  let cache: unknown = nativeCatalogue;
  if (nativeTools && cache === undefined) throw new Error('Native Codex requires model metadata refreshed through its configured native runtime before provider start.');
  if (!nativeTools && cache === undefined) {
    try { cache = JSON.parse(await readFile(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'models_cache.json'), 'utf8')); }
    catch { throw new Error('Codex model metadata is unavailable. Open Codex once to refresh its model catalogue.'); }
  }
  const path = join(directory, 'model-profile.json');
  await writeFile(path, JSON.stringify(nativeCoding ? nativeCodingCodexModel(model, cache) : restrictedCodexModel(model, cache, nativeTools)), { flag: 'wx', mode: 0o600 });
  return path;
}
