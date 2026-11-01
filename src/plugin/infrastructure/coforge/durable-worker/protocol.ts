import { createHash } from 'node:crypto';
import { boolean, list, number, oneOf, optional, record, shape, text, timestamp } from '../../../features/coforge/domain/check';
import { configuredStepExecutionCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { durableBuildPolicyCheck, durableBuildRefCheck, type DurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { settingsCheck } from '../../../features/coforge/domain/persisted';
import { ideaContextsCheck } from '../../../features/coforge/domain/idea-context';
import { requestObjectFieldsCheck, requestObjectValuesCheck } from '../../../features/coforge/domain/request-object';
import { requestCategoriesCheck } from '../../../features/coforge/domain/request-categories';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import type { DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import { protectedPrefix } from './protection';
import { backgroundBuildSnapshotRefCheck } from '../../../features/coforge/domain/background-build-retry';

const id = text({ min: 1, max: 160 });
const bounded = text({ max: 64000 });
const requestObject = (value: unknown) => {
  const checked = shape({ className: text({ max: 80 }), fields: requestObjectFieldsCheck, values: record, categories: optional(requestCategoriesCheck) }, { strict: true })(value);
  return { ...checked, values: requestObjectValuesCheck(checked.fields, checked.values, true) };
};
const idea = shape({ id, number: number({ integer: true, min: 1 }), projectId: optional(id), title: text({ min: 1, max: 200 }), description: bounded,
  authorId: id, category: text({ max: 80 }), status: oneOf(['inbox', 'screened', 'ranked', 'planned', 'building', 'review', 'shipped', 'flagged', 'rejected'] as const),
  requestKind: optional(oneOf(['feature', 'bug'] as const)), voters: list(id, { max: 100000 }), createdAt: timestamp, updatedAt: timestamp,
  contexts: optional(ideaContextsCheck), requestObject: optional(requestObject), reviewNote: optional(bounded), lastError: optional(bounded),
  screening: optional(shape({ verdict: oneOf(['clear', 'flagged'] as const), reason: bounded, signals: list(bounded), checkedAt: timestamp, provider: oneOf(['demo', 'claude', 'herdr', 'codex', 'mcp'] as const) }, { strict: true })),
  rice: optional(shape({ reach: number({ min: 0 }), impact: number({ min: 0 }), confidence: number({ min: 0 }), effort: number({ min: 0 }), score: number({ min: 0 }), rationale: bounded }, { strict: true })),
  plan: optional(shape({ summary: bounded, steps: list(bounded), acceptanceCriteria: list(bounded), risks: list(bounded), markdown: bounded, createdAt: timestamp }, { strict: true })),
}, { strict: true });
const request = shape({ protectedProjectPaths: list((value: unknown) => protectedPrefix(text({ max: 4096 })(value)), { max: 500 }), reviewedSnapshot: optional(backgroundBuildSnapshotRefCheck), version: oneOf([1] as const), jobId: id, projectId: id, ideaId: id, runId: id, attemptId: id, policy: durableBuildPolicyCheck,
  input: shape({ jobId: id, stage: oneOf(['implement'] as const), idea, settings: settingsCheck,
    integration: shape({ projectPath: text({ min: 1, max: 4096 }), worktreeFolder: text({ max: 4096 }), allowImplementation: boolean, claudeBin: text({ min: 1, max: 4096 }), codexBin: optional(text({ min: 1, max: 4096 })), ideasFolder: text({ min: 1, max: 4096 }), publicFolder: text({ min: 1, max: 4096 }) }, { strict: true }),
    workflow: configuredStepExecutionCheck,
  }, { strict: true }),
}, { strict: true });
export function workerRequestCheck(value: unknown): DurableBuildRequest {
  const checked = request(value); const input = checked.input;
  if (input.workflow.backgroundRetryId && input.workflow.polishingId || Boolean(checked.reviewedSnapshot) !== Boolean(input.workflow.backgroundRetryId || input.workflow.polishingId) ||
      input.jobId !== checked.jobId || input.idea.id !== checked.ideaId || ideaProjectId(input.idea) !== checked.projectId ||
      input.workflow.runId !== checked.runId || input.workflow.attemptId !== checked.attemptId || input.workflow.step.output !== 'codechange' ||
      input.workflow.step.access !== 'editworktree' || !input.integration.allowImplementation ||
      !['claude', 'codex'].includes(input.workflow.step.provider) || input.workflow.step.provider !== input.settings.provider ||
      input.workflow.step.model !== input.settings.model ||
      canonical({ ...input.workflow.step.execution, idleWarningSeconds: input.workflow.step.execution?.idleWarningSeconds ?? 1800 }) !== canonical({ ...checked.policy, idleWarningSeconds: checked.policy.idleWarningSeconds ?? 1800 }))
    throw new Error('The authorized native Build input does not match its captured identities, policy or access.');
  return checked;
}
export function canonical(value: unknown): string {
  const order = (item: unknown): unknown => Array.isArray(item) ? item.map(order) : item && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, order(entry)])) : item;
  return JSON.stringify(order(value)) ?? 'null';
}
export const inputHash = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export const workerDescriptorCheck = shape({ version: oneOf([1] as const), workerId: id, epoch: number({ integer: true, min: 1 }), nonce: id,
  token: text({ pattern: /^[a-f0-9]{64}$/u }), endpoint: text({ pattern: /^http:\/\/127\.0\.0\.1:\d+\/v1$/u }), sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }), pid: number({ integer: true, min: 1 }), startedAt: timestamp,
}, { strict: true });
export type WorkerDescriptor = ReturnType<typeof workerDescriptorCheck>;
export function workerRef(value: unknown, workerId: string, epoch: number): DurableBuildRef { const ref = durableBuildRefCheck(value); if (ref.workerId !== workerId || ref.epoch !== epoch) throw new Error('The original Build worker identity changed. Inspect it before retrying.'); return ref; }
