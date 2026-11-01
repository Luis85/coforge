import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCodexArgs, codexResult, codexUsage } from '../../features/coforge/application/codex-protocol';
import type { ReasoningEffort } from '../../features/coforge/domain/provider-models';
import type { StageUsage } from '../../features/coforge/domain/ai-usage';
import { captureProcess, childEnvironment, ProcessFailure, type ProcessOptions } from './process';
import { codexExecutable } from './codex-executable';
import { writeCodexModelProfile } from './codex-model-profile';
import { codexOutputSchema, normalizeCodexOutput } from '../../features/coforge/application/codex-schema';
import type { AgentConversationEvent } from '../../features/coforge/domain/agent-conversation';
import { captureCodexResponse } from './codex-conversation';
import type { NativeWorkflowTools } from '../../features/coforge/domain/native-workflow-tools';
import { assertCodexNativeCapabilities, assertCodexNativeContext, nativeCodexCatalogue } from './codex-native-capabilities';
import { prepareNativeCodexState } from './codex-private-state';
import { assertCodexPrivateRuntime } from './codex-private-runtime';
import type { NativeWorkflowPrivateRuntime } from '../../features/coforge/domain/native-workflow-process';
import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';
import { providerSessionObserver } from './provider-session-stream';
import { captureProviderFailure, diagnoseProviderFailure } from './provider-failure';
import { assignProviderFailure, providerFailureFor } from '../../features/coforge/domain/provider-failure';
import { persistProviderEvidence } from './provider-evidence';

export interface CodexTransportInput {
  directory: string; executable?: string; model: string; effort?: ReasoningEffort;
  schema: object; instructions: string; prompt: string; timeoutMs: number; signal?: AbortSignal;
  mcp?: { url: string; token: string; toolTimeoutSeconds?: number };
  nativeTools?: NativeWorkflowTools;
  privateRuntime?: NativeWorkflowPrivateRuntime;
  capture?: (executable: string, args: readonly string[], options: ProcessOptions) => Promise<string>;
  telemetry?(usage: StageUsage | undefined): Promise<void>;
  onConversation?(event: AgentConversationEvent): Promise<void>;
  onOwnedProcess?: ProcessOptions['onOwnedProcess'];
  onSessionEvent?(event: AgentSessionEvent): Promise<void>;
}
export function codexEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...childEnvironment(source), ...Object.fromEntries(Object.entries(source).filter(([key, value]) =>
    ['CODEX_HOME', 'CODEX_API_KEY', 'OPENAI_API_KEY'].includes(key) && value !== undefined)) };
}
/** A raw provider stream never reaches a note or user-facing error. */
export async function runCodexTransport(input: CodexTransportInput): Promise<{ output: unknown; usage?: StageUsage }> {
  try { return await runScopedCodexTransport(input); }
  catch (error) { const failure = diagnoseProviderFailure('codex', error, input.signal); await captureProviderFailure(input.onSessionEvent, failure); throw failure; }
}
async function runScopedCodexTransport(input: CodexTransportInput): Promise<{ output: unknown; usage?: StageUsage }> {
  if (input.nativeTools?.delegation && (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0)) throw assignProviderFailure(new Error('Codex native delegation requires a finite invocation deadline.'), providerFailureFor('configuration'));
  const schemaPath = join(input.directory, 'result-schema.json');
  await writeFile(schemaPath, JSON.stringify(codexOutputSchema(input.schema)), { flag: 'wx', mode: 0o600 });
  const executable = await codexExecutable(input.executable);
  const delegated = Boolean(input.nativeTools?.delegation);
  if (input.nativeTools) {
    if (!input.privateRuntime) throw assignProviderFailure(new Error('Native Codex requires a retained private runtime ownership receipt before state preparation.'), providerFailureFor('configuration'));
    await assertCodexPrivateRuntime(input.privateRuntime, input.directory);
  }
  const nativeState = input.nativeTools ? await prepareNativeCodexState(input.directory) : undefined;
  const invocation = { model: input.model, effort: input.effort, schemaPath, mcpUrl: input.mcp?.url, mcpToolTimeoutSeconds: input.mcp?.toolTimeoutSeconds, nativeTools: input.nativeTools, nativeState };
  const proposedArgs = buildCodexArgs({ ...invocation, modelProfilePath: join(input.directory, 'model-profile.json') });
  if (delegated) await assertCodexNativeCapabilities(executable, input.directory, proposedArgs, input.signal);
  const environment = { ...codexEnvironment(), ...(input.mcp ? { COFORGE_CODEX_MCP_TOKEN: input.mcp.token } : {}) };
  const catalogue = input.nativeTools ? await nativeCodexCatalogue(executable, input.directory, input.model, input.nativeTools, environment, proposedArgs, input.signal) : undefined;
  const modelProfilePath = await writeCodexModelProfile(input.directory, input.model, input.nativeTools, catalogue);
  const args = buildCodexArgs({ ...invocation, modelProfilePath });
  if (input.nativeTools?.delegation) await assertCodexNativeContext(executable, input.directory, input.model, input.nativeTools.delegation.maxConcurrent, args, environment, input.signal);
  const instructions = `${input.instructions}\n\nUse only the scoped CoForge MCP tools. ${delegated
    ? 'You may coordinate provider-native subagents within the captured concurrency limit; descendants inherit the same scoped CoForge tools, selected model and restricted sandbox. This limits concurrent children, not total lifetime children or nesting depth. Finish child work before returning the root structured result. Native project files, shell, browser and other MCP servers are unavailable.'
    : 'Native project files, shell, browser, other MCP servers and delegation are unavailable.'} Return the required structured result.`;
  const observer = providerSessionObserver({ provider: 'codex', capture: input.onSessionEvent, environment, privatePaths: [input.directory] });
  try {
    await persistProviderEvidence(() => input.onConversation?.({ kind: 'request', instructions, prompt: input.prompt }));
    input.signal?.throwIfAborted();
    const raw = await (input.capture ?? captureProcess)(executable, args, {
      cwd: input.directory, timeoutMs: input.timeoutMs, signal: input.signal,
      input: `${instructions}\n\n${input.prompt}`,
      env: environment,
      ...(input.onSessionEvent ? { onStdout: observer.push } : {}),
      ...(input.nativeTools ? { ownedTree: true as const } : {}),
      ...(input.onOwnedProcess ? { onOwnedProcess: input.onOwnedProcess } : {}),
    });
    await persistProviderEvidence(() => input.telemetry?.(codexUsage(raw, { delegated })));
    await captureCodexResponse(input.onConversation, raw, environment);
    const result = codexResult(raw, { delegated });
    return { ...result, output: normalizeCodexOutput(result.output, input.schema) };
  } catch (error) {
    if (error instanceof ProcessFailure) {
      await persistProviderEvidence(() => input.telemetry?.(codexUsage(error.output, { delegated })));
      await captureCodexResponse(input.onConversation, error.output, environment);
      throw diagnoseProviderFailure('codex', error);
    }
    if (error instanceof SyntaxError) throw diagnoseProviderFailure('codex', error);
    throw error;
  } finally { await observer.finish().catch(() => {}); }
}
