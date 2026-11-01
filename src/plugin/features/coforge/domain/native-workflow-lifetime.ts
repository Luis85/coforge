import { oneOf, shape, text } from './check';

/** Private ownership of one OS lifetime controller; never model-authored command authority. */
export interface NativeWorkflowLifetimeRef {
  version: 1; kind: 'windows-job'; directory: string; ownerToken: string; sourceHash: string;
  runId: string; attemptId: string; projectId: string;
}
const id = text({ min: 1, max: 160 });
export const nativeWorkflowLifetimeRefCheck = shape({ version: oneOf([1] as const), kind: oneOf(['windows-job'] as const),
  directory: text({ min: 1, max: 4096 }), ownerToken: text({ pattern: /^[a-f0-9]{64}$/u }), sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }),
  runId: id, attemptId: id, projectId: id }, { strict: true });
