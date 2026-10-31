import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCodexArgs, codexResult, codexUsage } from '../../features/coforge/application/codex-protocol';
import type { ReasoningEffort } from '../../features/coforge/domain/provider-models';
import type { StageUsage } from '../../features/coforge/domain/ai-usage';
import { captureProcess, childEnvironment, ProcessFailure, type ProcessOptions } from './process';
import { codexExecutable } from './codex-executable';
import { writeCodexModelProfile } from './codex-model-profile';
import { codexOutputSchema, normalizeCodexOutput } from '../../features/coforge/application/codex-schema';

export interface CodexTransportInput {
  directory: string; executable?: string; model: string; effort?: ReasoningEffort;
  schema: object; instructions: string; prompt: string; timeoutMs: number; signal?: AbortSignal;
  mcp?: { url: string; token: string };
  capture?: (executable: string, args: readonly string[], options: ProcessOptions) => Promise<string>;
  telemetry?(usage: StageUsage | undefined): Promise<void>;
}
export function codexEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...childEnvironment(source), ...Object.fromEntries(Object.entries(source).filter(([key, value]) =>
    ['CODEX_HOME', 'CODEX_API_KEY', 'OPENAI_API_KEY'].includes(key) && value !== undefined)) };
}
/** A raw provider stream never reaches a note or user-facing error. */
export async function runCodexTransport(input: CodexTransportInput): Promise<{ output: unknown; usage?: StageUsage }> {
  const schemaPath = join(input.directory, 'result-schema.json');
  await writeFile(schemaPath, JSON.stringify(codexOutputSchema(input.schema)), { flag: 'wx', mode: 0o600 });
  const modelProfilePath = await writeCodexModelProfile(input.directory, input.model);
  const args = buildCodexArgs({ model: input.model, effort: input.effort, schemaPath, modelProfilePath, mcpUrl: input.mcp?.url });
  try {
    const raw = await (input.capture ?? captureProcess)(await codexExecutable(input.executable), args, {
      cwd: input.directory, timeoutMs: input.timeoutMs, signal: input.signal,
      input: `${input.instructions}\n\nUse only the scoped CoForge MCP tools. Native project files, shell, browser, other MCP servers and delegation are unavailable. Return the required structured result.\n\n${input.prompt}`,
      env: { ...codexEnvironment(), ...(input.mcp ? { COFORGE_CODEX_MCP_TOKEN: input.mcp.token } : {}) },
    });
    await input.telemetry?.(codexUsage(raw));
    const result = codexResult(raw);
    return { ...result, output: normalizeCodexOutput(result.output, input.schema) };
  } catch (error) {
    if (error instanceof ProcessFailure) {
      await input.telemetry?.(codexUsage(error.output));
      throw new Error(/^Run (?:cancelled|timed out)/u.test(error.message) ? error.message : 'Codex did not complete this attempt. Check its local installation, sign-in, model access and configured limits; review partial worktree changes before retrying.');
    }
    if (error instanceof SyntaxError) throw new Error('Codex returned invalid structured output. The request was not advanced.');
    throw error;
  }
}
