import { boolean, list, number, optional, shape, text, timestamp, type Check } from './check';
import { workflowSourceHashCheck, workflowVerificationRecordsCheck } from './workflow-verification';
import type { Increment } from './types';

/** Canonical persisted increments, including valid legacy evidence; provider outputs use stricter contracts. */
const string = text();
export const incrementStateCheck: Check<Increment> = shape({
  verification: optional(workflowVerificationRecordsCheck), verificationSourceHash: optional(workflowSourceHashCheck),
  snapshotHash: optional(text({ pattern: /^[a-f0-9]{64}$/u })),
  summary: string, files: list(shape({ path: string, additions: number({ min: 0 }), deletions: number({ min: 0 }) })), tests: list(string), diff: string,
  branch: optional(string), worktree: optional(string), commit: optional(string), createdAt: timestamp, simulated: boolean,
});
