import { list, oneOf, optional, shape, text, timestamp } from './check';
import { workflowIdCheck } from './configured-workflow';
import { durableBuildResultCheck } from './durable-build';
import type { Increment } from './types';
const increment = (value: unknown): Increment => { const checked = durableBuildResultCheck({ increment: value }).increment; if (!checked) throw new Error('A real resource capture is required.'); return checked; };
export const polishingCodeBindingCheck = shape({ id: workflowIdCheck, workspaceId: workflowIdCheck, ownerRunId: workflowIdCheck, mode: oneOf(['foreground', 'background'] as const),
  workspaceEpoch: workflowIdCheck, increment, evidenceHash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
export const polishingAmendmentsCheck = list(shape({ id: workflowIdCheck, polishingRunId: workflowIdCheck, artifactId: workflowIdCheck, artifactHash: workflowIdCheck,
  targetIdentity: workflowIdCheck, proposalRevision: workflowIdCheck, approvedAt: timestamp, resourceBinding: optional(polishingCodeBindingCheck) }, { strict: true }), { max: 100 });
