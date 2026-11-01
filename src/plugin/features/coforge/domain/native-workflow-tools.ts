import { boolean, list, number, optional, shape, text, type Check } from './check';

export interface NativeWorkflowTools {
  delegation?: { maxConcurrent: number };
  verification?: { commandIds: string[] };
}
export interface WorkflowVerificationCommand { id: string; label: string; executable: string; args: string[] }
export interface WorkflowVerificationProfile {
  enabled: boolean; dockerBin: string; imageId: string; commands: WorkflowVerificationCommand[]; timeoutSeconds: number; maxRuns: number;
}
const id = text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u });
const command = shape({ id, label: text({ trim: true, min: 1, max: 200 }), executable: text({ trim: true, min: 1, max: 1000 }), args: list(text({ max: 2000 }), { max: 64 }) }, { strict: true });
export const workflowVerificationCommandCheck: Check<WorkflowVerificationCommand> = (value, path) => {
  const result = command(value, path);
  let bytes = 0;
  for (const char of JSON.stringify(result)) { const code = char.charCodeAt(0); bytes += char.length === 2 ? 4 : code < 128 ? 1 : code < 2048 ? 2 : 3; }
  if (bytes > 4096) throw new Error('Each approved verification command must fit within 4096 encoded bytes, including its label and arguments.');
  return result;
};
const tools = shape({ delegation: optional(shape({ maxConcurrent: number({ integer: true, min: 1, max: 8 }) }, { strict: true })), verification: optional(shape({ commandIds: list(id, { min: 1, max: 16 }) }, { strict: true })) }, { strict: true });
export const nativeWorkflowToolsCheck: Check<NativeWorkflowTools> = (value, path) => {
  const result = tools(value, path);
  if (!result.delegation && !result.verification) throw new Error('Select native delegation or verification, or omit the native tools policy.');
  if (result.verification && new Set(result.verification.commandIds).size !== result.verification.commandIds.length) throw new Error('Verification command selections must be unique.');
  return result;
};
const profile = shape({ enabled: boolean, dockerBin: text({ trim: true, min: 1, max: 1000 }), imageId: text({ trim: true, max: 1000 }), commands: list(workflowVerificationCommandCheck, { max: 16 }), timeoutSeconds: number({ integer: true, min: 5, max: 1800 }), maxRuns: number({ integer: true, min: 1, max: 32 }) }, { strict: true });
export const workflowVerificationProfileCheck: Check<WorkflowVerificationProfile> = (value, path) => {
  const result = profile(value, path);
  if (new Set(result.commands.map(command => command.id)).size !== result.commands.length) throw new Error('Verification command IDs must be unique.');
  if (result.enabled && (!/^sha256:[a-f0-9]{64}$/u.test(result.imageId) || !result.commands.length)) throw new Error('Enable verification with an existing sha256 image ID and at least one command. Images are never pulled automatically.');
  return result;
};
export const defaultWorkflowVerificationProfile = (): WorkflowVerificationProfile => ({ enabled: false, dockerBin: 'docker', imageId: '', commands: [], timeoutSeconds: 600, maxRuns: 8 });

interface NativeStep { nativeTools?: NativeWorkflowTools; provider: string; coworkerId?: string; access: string; execution?: { mode: string; maxRuntimeSeconds?: number } }
/** Definition validation may defer provider resolution for a saved CoWorker; admission must supply it. */
export function validateNativeWorkflowTools(step: NativeStep, effectiveProvider?: string, external = false): void {
  if (!step.nativeTools) return;
  const policy = nativeWorkflowToolsCheck(step.nativeTools);
  const provider = effectiveProvider ?? (step.coworkerId ? undefined : step.provider);
  if (external || provider !== undefined && !['claude', 'codex'].includes(provider)) throw new Error('Native tools require a captured native Claude Code or Codex workflow invocation. External MCP, Herdr and simulation cannot adopt this policy.');
  if (policy.verification && step.access === 'none') throw new Error('Verification requires read-only project or isolated worktree access.');
  if (policy.delegation && provider === 'codex' && step.execution && step.execution.maxRuntimeSeconds === undefined) throw new Error('Delegated background Codex requires an explicit elapsed deadline.');
}

/** Only the independently saved host grant supplies executable command definitions. */
export function captureWorkflowVerification(tools: NativeWorkflowTools | undefined, host: WorkflowVerificationProfile | undefined, access: string): WorkflowVerificationProfile | undefined {
  if (!tools?.verification) return;
  if (access === 'none') throw new Error('Verification requires project access.');
  if (!host?.enabled) throw new Error('Verification is not enabled in Vault integrations. Save a Docker verification profile before admitting this step.');
  const captured = workflowVerificationProfileCheck(host);
  const ids = nativeWorkflowToolsCheck(tools).verification!.commandIds;
  if (ids.some(id => !captured.commands.some(command => command.id === id))) throw new Error('A selected verification command is unavailable in Vault integrations. Review the saved host grant.');
  return { ...captured, commands: captured.commands.filter(command => ids.includes(command.id)).map(command => ({ ...command, args: [...command.args] })) };
}
