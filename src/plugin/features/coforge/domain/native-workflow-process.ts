import { number, oneOf, optional, shape, text, timestamp, type Check } from './check';
import { nativeWorkflowLifetimeRefCheck, type NativeWorkflowLifetimeRef } from './native-workflow-lifetime';

export interface NativeWorkflowProcessIdentity { pid: number; platform: string; birth: string; image: string; groupId?: number }
export interface NativeWorkflowPrivateRuntime { directory: string; ownerToken: string; runId: string; attemptId: string; projectId: string }
/** Private original-provider ownership, never an agent-authored child job or public projection. */
export interface NativeWorkflowProcessRecord {
  runId: string; attemptId: string; projectId: string; identity: NativeWorkflowProcessIdentity;
  phase: 'launched' | 'terminated' | 'unknown'; observedAt: string;
  /** Explicit operator acknowledgement of unresolved ownership; never an OS termination receipt. */
  operatorAcknowledgedAt?: string;
  privateRuntime?: NativeWorkflowPrivateRuntime;
  lifetime?: NativeWorkflowLifetimeRef;
}
const id = text({ min: 1, max: 160 });
export const nativeWorkflowPrivateRuntimeCheck = shape({ directory: text({ min: 1, max: 4096 }), ownerToken: text({ pattern: /^[a-f0-9]{64}$/u }), runId: id, attemptId: id, projectId: id }, { strict: true });
export const nativeWorkflowProcessIdentityCheck = shape({ pid: number({ integer: true, min: 1, max: 2147483647 }), platform: text({ min: 1, max: 40 }), birth: text({ min: 1, max: 320 }),
  image: text({ pattern: /^[a-f0-9]{64}$/u }), groupId: optional(number({ integer: true, min: 1, max: 2147483647 })) }, { strict: true });
const processRecord = shape({ runId: id, attemptId: id, projectId: id, identity: nativeWorkflowProcessIdentityCheck,
  phase: oneOf(['launched', 'terminated', 'unknown'] as const), observedAt: timestamp, operatorAcknowledgedAt: optional(timestamp), privateRuntime: optional(nativeWorkflowPrivateRuntimeCheck), lifetime: optional(nativeWorkflowLifetimeRefCheck) }, { strict: true });
export const nativeWorkflowProcessRecordCheck: Check<NativeWorkflowProcessRecord> = (value, path) => {
  const record = processRecord(value, path);
  if (record.privateRuntime && (record.privateRuntime.runId !== record.runId || record.privateRuntime.attemptId !== record.attemptId || record.privateRuntime.projectId !== record.projectId))
    throw new Error('Private native runtime ownership does not match its original provider.');
  if (record.lifetime && (record.lifetime.runId !== record.runId || record.lifetime.attemptId !== record.attemptId || record.lifetime.projectId !== record.projectId || record.identity.platform !== 'win32'))
    throw new Error('Private native process lifetime does not match its original execution.');
  return record;
};
