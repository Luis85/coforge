import { number, oneOf, record, shape, type Check } from './check';

export interface NativeCodingProfile { version: 1; profile: 'native-worktree-v1'; maxConcurrent: number }
export interface McpWorktreeCodingProfile { version: 1; profile: 'mcp-worktree-v1' }
export type WorktreeCodingCapability = NativeCodingProfile | McpWorktreeCodingProfile;
export const nativeCodingProfileCheck: Check<NativeCodingProfile> = shape({ version: oneOf([1] as const), profile: oneOf(['native-worktree-v1'] as const), maxConcurrent: number({ integer: true, min: 1, max: 8 }) }, { strict: true });
const mcpCodingProfileCheck = shape({ version: oneOf([1] as const), profile: oneOf(['mcp-worktree-v1'] as const) }, { strict: true });
export const worktreeCodingCapabilityCheck: Check<WorktreeCodingCapability> = (value, path) => record(value).profile === 'mcp-worktree-v1' ? mcpCodingProfileCheck(value, path) : nativeCodingProfileCheck(value, path);
interface CodingStep { kind?: string; access: string; output: string; nativeTools?: { delegation?: { maxConcurrent: number } } }
export function isWorktreeCodingStep(step: CodingStep, provider: string): boolean {
  return step.kind === 'ai' && ['claude', 'codex', 'mcp'].includes(provider) && step.access === 'editworktree' && step.output === 'codechange';
}
/** Only new host-authorized admissions receive this marker. Missing markers never acquire new rights at runtime. */
export function captureWorktreeCodingCapability(step: CodingStep, provider: string, allowImplementation: boolean): WorktreeCodingCapability | undefined {
  if (!allowImplementation || !isWorktreeCodingStep(step, provider)) return;
  if (provider === 'mcp') return { version: 1, profile: 'mcp-worktree-v1' };
  return nativeCodingProfileCheck({ version: 1, profile: 'native-worktree-v1', maxConcurrent: step.nativeTools?.delegation?.maxConcurrent ?? 2 });
}
