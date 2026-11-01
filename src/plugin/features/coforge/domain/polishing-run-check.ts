import { boolean, list, number, oneOf, optional, shape, text, timestamp } from './check';
import { workflowArtifactCheck, workflowRunCheck, workflowSerializedSize, WORKFLOW_HISTORY_LIMIT_BYTES } from './configured-workflow-run';
import { workflowIdCheck } from './configured-workflow';
import { IDEA_STATUSES } from './types';
import { backgroundBuildRetrySourceCheck, backgroundBuildSnapshotRefCheck } from './background-build-retry';
import { polishingTargetCheck } from './polishing-target';
import type { PolishingRun } from './polishing';
export { polishingCodeBindingCheck, polishingAmendmentsCheck } from './polishing-reference-check';

export const polishingCheckpointCheck = shape({ runId: workflowIdCheck, revision: number({ integer: true, min: 0 }), cursor: number({ integer: true, min: 0, max: 40 }),
  state: oneOf(['ready', 'running', 'waiting-human', 'attention', 'finished', 'awaiting-review', 'stopped'] as const), contentHash: workflowIdCheck }, { strict: true });
const applyIntent = shape({ id: workflowIdCheck, sourceArtifactId: workflowIdCheck, sourceArtifactHash: workflowIdCheck, createdAt: timestamp,
  targetRunId: workflowIdCheck, mode: oneOf(['foreground', 'background'] as const), workspaceEpoch: workflowIdCheck, primaryCheckpointHash: workflowIdCheck,
  snapshot: backgroundBuildSnapshotRefCheck, baseline: backgroundBuildSnapshotRefCheck, sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
const check = shape({ id: workflowIdCheck, feedback: text({ min: 1, max: 8000 }), target: polishingTargetCheck, primaryCheckpoint: optional(polishingCheckpointCheck),
  sourceHash: workflowIdCheck, consent: shape({ oldExecutorStopped: boolean, changesReviewed: boolean, releaseStopHold: boolean }, { strict: true }),
  stopVersion: optional(number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER })),
  workflow: workflowRunCheck, sourceArtifacts: list(workflowArtifactCheck, { max: 200 }), policySourceRevision: workflowIdCheck, createdAt: timestamp,
  review: oneOf(['pending', 'applied', 'rejected'] as const), reviewedAt: optional(timestamp), previousStatus: oneOf(IDEA_STATUSES), applyIntent: optional(applyIntent),
  applyIntentHistory: optional(list(applyIntent, { max: 25 })), applyFailure: optional(shape({ intentId: workflowIdCheck, code: oneOf(['POLISHING_COPY_RETAINED'] as const), message: text({ max: 1000 }), at: timestamp }, { strict: true })),
  reviewedSnapshot: optional(backgroundBuildSnapshotRefCheck), reviewedSource: optional(backgroundBuildRetrySourceCheck) }, { strict: true });
export function polishingRunCheck(value: unknown): PolishingRun {
  const run = check(value);
  if (run.id !== run.workflow.id || run.workflow.definition.steps.length !== 1 || run.workflow.definition.steps[0]?.kind !== 'ai' || run.workflow.definition.steps[0].automatic ||
      run.workflow.cursor > 1 || (!!run.reviewedSnapshot !== !!run.reviewedSource)) throw new Error('The auxiliary polishing run has inconsistent captured identities.');
  return run;
}
export function polishingRunsCheck(value: unknown): PolishingRun[] {
  if (workflowSerializedSize(value) > WORKFLOW_HISTORY_LIMIT_BYTES) throw new Error('The preserved polishing history exceeds 8 MiB. Export it before starting another pass.');
  const runs = list(polishingRunCheck, { max: 25 })(value);
  if (new Set(runs.map(run => run.id)).size !== runs.length) throw new Error('Polishing run IDs must be unique.');
  return runs;
}
