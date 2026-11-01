import { captureProcess, type ProcessOptions } from './process';
import { record } from '../../features/coforge/domain/check';
import type { NativeWorkflowTools } from '../../features/coforge/domain/native-workflow-tools';
import { assignProviderFailure, providerFailureFor, providerFailureInfo, providerFailureMessage } from '../../features/coforge/domain/provider-failure';
import { diagnoseProviderFailure } from './provider-failure';

const REQUIRED_FLAGS = ['--strict-config', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--sandbox', '--json', '--output-schema'];
const PROBE_ENV = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP']);

/** No inference: validate the installed CLI and actual bounded feature table in a private configuration home. */
export async function assertCodexNativeCapabilities(executable: string, directory: string, args: readonly string[], signal?: AbortSignal): Promise<void> {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key, value]) => PROBE_ENV.has(key) && value !== undefined)), CODEX_HOME: directory };
  const options: ProcessOptions = { cwd: directory, env, timeoutMs: 5000, maxBytes: 64000, signal };
  const unavailable = () => assignProviderFailure(new Error('Codex native delegation requires CLI 0.145.0 or newer with the verified restricted flags and bounded native v2 configuration. No provider was started.'), providerFailureFor('capability'));
  try {
    signal?.throwIfAborted();
    const version = /codex-cli (\d+)\.(\d+)\.(\d+)/u.exec(await captureProcess(executable, ['--version'], options));
    if (!version || Number(version[1]) === 0 && Number(version[2]) < 145) throw unavailable();
    const help = await captureProcess(executable, ['exec', '--help'], options);
    if (REQUIRED_FLAGS.some(flag => !help.includes(flag))) throw unavailable();
    const table = args.find(value => value.startsWith('features.multi_agent_v2={'));
    if (!table) throw unavailable();
    const features = await captureProcess(executable, ['features', 'list', '--config', table, '--config', 'features.multi_agent=false', '--config', 'features.hooks=false', '--config', 'features.plugins=false'], options);
    if (!/^multi_agent_v2\s+stable\s+true\s*$/mu.test(features)) throw unavailable();
    signal?.throwIfAborted();
  } catch {
    signal?.throwIfAborted();
    throw unavailable();
  }
}

/** Read configured catalogue metadata with canonical SDK authentication and closed provider/tool settings. No inference. */
export async function nativeCodexCatalogue(executable: string, directory: string, model: string, nativeTools: NativeWorkflowTools,
  environment: NodeJS.ProcessEnv, args: readonly string[], signal?: AbortSignal): Promise<{ models: Record<string, unknown>[] }> {
  const env = { ...environment }; delete env.COFORGE_CODEX_MCP_TOKEN;
  const overrides: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const value = args[index + 1];
    if (args[index] === '--config' && value) {
      index++;
      if (!/^(?:model_catalog_json|mcp_servers|features.multi_agent_v2)=/u.test(value)) overrides.push('--config', value);
    }
  }
  overrides.push('--config', 'mcp_servers={}', '--config', 'features.multi_agent_v2=false');
  // Unlike exec, debug models cannot ignore personal config. Pin discovery endpoints only;
  // exec must retain the SDK's auth-dependent ChatGPT/API endpoint selection.
  overrides.push('--config', 'openai_base_url="https://api.openai.com/v1"', '--config', 'chatgpt_base_url="https://chatgpt.com/backend-api/"');
  let models: Record<string, unknown>[];
  try {
    const raw = await captureProcess(executable, ['debug', 'models', ...overrides], { cwd: directory, env, signal, timeoutMs: 15000, maxBytes: 2 * 1024 * 1024 });
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : record(parsed).models;
    if (!Array.isArray(values)) throw new Error('Invalid catalogue');
    models = values.map(value => record(value));
  } catch (error) {
    signal?.throwIfAborted();
    const diagnosed = providerFailureInfo(diagnoseProviderFailure('codex', error));
    const info = diagnosed && !['execution_failed', 'output_validation'].includes(diagnosed.code) ? diagnosed : providerFailureFor('configuration');
    throw assignProviderFailure(new Error(`Codex could not refresh native model availability. ${providerFailureMessage(info)} No model inference was started.`), info);
  }
  const selected = models.find(item => item.slug === model);
  if (!selected) throw assignProviderFailure(new Error('The selected model is not advertised by this configured native Codex runtime. Explicitly choose an available native model; CoForge never substitutes another model. No model inference was started.'), providerFailureFor('model_access'));
  if (nativeTools.delegation && selected.multi_agent_version !== 'v2') throw assignProviderFailure(new Error('The selected native Codex model does not advertise v2 delegation. Explicitly choose a supported model. No model inference was started.'), providerFailureFor('capability'));
  return { models };
}

/** Verify the installed V2 backend's root-inclusive slot semantics instead of assuming future versions match. */
export async function assertCodexNativeContext(executable: string, directory: string, model: string, maxConcurrent: number,
  args: readonly string[], environment: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<void> {
  const overrides: string[] = [];
  for (let index = 0; index < args.length; index++) if (args[index] === '--config' && args[index + 1]) overrides.push('--config', args[++index]!);
  try {
    const raw = await captureProcess(executable, ['debug', 'prompt-input', ...overrides, '--config', `model=${JSON.stringify(model)}`, '--config', 'sandbox_mode="read-only"',
      'CoForge native concurrency qualification only. Do not run tools.'], { cwd: directory, env: environment, signal, timeoutMs: 10000, maxBytes: 2 * 1024 * 1024 });
    const strings: string[] = [];
    const visit = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(record(value)).forEach(visit);
    };
    visit(JSON.parse(raw));
    const slots = [...strings.join('\n').matchAll(/There are (\d+) available concurrency slots, meaning that up to \d+ agents can be active at once, including you\./gu)];
    if (slots.length !== 1 || Number(slots[0]![1]) !== maxConcurrent + 1) throw new Error('Unexpected native slot semantics');
  } catch {
    signal?.throwIfAborted();
    throw assignProviderFailure(new Error('Codex native concurrency boundary could not be verified for this CLI and selected model. No provider inference was started; use a qualified CLI version or disable native delegation.'), providerFailureFor('capability'));
  }
}
