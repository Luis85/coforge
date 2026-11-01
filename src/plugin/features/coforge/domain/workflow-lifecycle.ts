import { oneOf, shape, type Check } from './check';

/** A lifecycle policy, independently captured from access and tool grants. Missing markers retain legacy policy. */
export interface ManagedWorkflowLifecycle { version: 1; mode: 'managed-session' }
export const managedWorkflowLifecycleCheck: Check<ManagedWorkflowLifecycle> = shape({
  version: oneOf([1] as const), mode: oneOf(['managed-session'] as const),
}, { strict: true });
export function captureWorkflowLifecycle(provider: string): ManagedWorkflowLifecycle | undefined {
  return ['claude', 'codex', 'mcp'].includes(provider) ? { version: 1, mode: 'managed-session' } : undefined;
}
export const isManagedWorkflowSession = (execution?: { lifecycle?: ManagedWorkflowLifecycle }): boolean => execution?.lifecycle?.mode === 'managed-session';
