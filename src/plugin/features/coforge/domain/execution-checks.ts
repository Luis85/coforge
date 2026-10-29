import { assertExecutionRunConsistency } from "./execution-consistency";
import {
  executionAllowanceCheck,
  executionAllowanceAuditCheck,
} from "./execution-allowance";
import { MESSAGE_REJECTION_CODES } from "./execution-message-rejection";
import {
  boolean,
  list,
  number,
  oneOf,
  optional,
  shape,
  text,
  timestamp,
} from "./check";
import { stageUsageCheck } from "./ai-usage";
import {
  workflowPlanCheck,
  workflowSerializedSize,
} from "./configured-workflow-run";
import { teamMessageDraftCheck } from "./team-messages";
import { executionMessagingStateCheck } from "./execution-outbox";
import { executionLocalActionCheck } from "./execution-local-action";

import {
  EXECUTION_RUN_BYTES,
  EXECUTION_JOURNAL_BYTES,
  type ExecutionRun,
  type ExecutionJournal,
} from "./execution-types";
import {
  executionIdCheck as id,
  executionIdsCheck as ids,
  executionProviderCheck as provider,
  executionInvocationCheck as invocationCheck,
  executionDispatchCheck as dispatchCheck,
  executionSubjectCheck,
} from "./execution-values";
export {
  executionSubjectCheck,
  executionResponseCheck,
} from "./execution-values";
const artifactCheck = shape(
  {
    id,
    runId: id,
    invocationId: id,
    attemptId: id,
    roundId: id,
    agentId: id,
    agentRevision: id,
    provider,
    model: text({ min: 1, max: 200 }),
    inputArtifactIds: ids,
    createdAt: timestamp,
    markdown: text({ min: 1, max: 16000 }),
    simulated: boolean,
    costUsd: optional(number({ min: 0 })),
    usage: optional(stageUsageCheck),
    messageDrafts: optional(list(teamMessageDraftCheck, { max: 100 })),
    messagesRejected: optional(boolean),
    messageRejection: optional(
      shape(
        {
          code: oneOf(MESSAGE_REJECTION_CODES),
          reason: text({ min: 1, max: 1000 }),
        },
        { strict: true },
      ),
    ),
    skipped: optional(boolean),
    skipReason: optional(text({ min: 1, max: 2000 })),
    plan: optional(workflowPlanCheck),
  },
  { strict: true },
);
const attemptCheck = shape(
  {
    id,
    invocationId: id,
    status: oneOf([
      "dispatching",
      "not-started",
      "unknown",
      "responded",
      "published",
    ] as const),
    startedAt: timestamp,
    dispatch: dispatchCheck,
    artifactId: optional(id),
    error: optional(text({ max: 2000 })),
    costUsd: optional(number({ min: 0 })),
    usage: optional(stageUsageCheck),
    usageSource: optional(oneOf(["provider"] as const)),
    skipped: optional(boolean),
    uncertaintyAcknowledgedAt: optional(timestamp),
  },
  { strict: true },
);
const limitsCheck = shape(
  {
    timeoutSeconds: number({ min: 1, max: 3600, integer: true }),
    maxTurns: number({ min: 1, max: 100, integer: true }),
    maxBudgetUsd: number({ min: 0, max: 1000 }),
    maxInvocations: optional(number({ min: 1, max: 100, integer: true })),
    executionLimitMs: optional(number({ min: 1, max: 7200000, integer: true })),
    simulation: boolean,
  },
  { strict: true },
);
const checkpointCheck = shape(
  {
    id,
    name: text({ min: 1, max: 100 }),
    instructions: text({ max: 16000 }),
    beforeCursor: number({ min: 0, max: 100, integer: true }),
    kind: oneOf(["approval", "checklist"] as const),
    items: list(
      shape(
        { id, label: text({ min: 1, max: 500 }), required: boolean },
        { strict: true },
      ),
      { max: 40 },
    ),
    order: optional(number({ min: 0, max: 40, integer: true })),
  },
  { strict: true },
);
export const executionAdmissionCheck = shape(
  {
    id,
    submissionKey: text({ min: 1, max: 1000 }),
    subject: executionSubjectCheck,
    projectId: id,
    teamId: id,
    context: text({ max: 160000 }),
    invocations: list(invocationCheck, { max: 100 }),
    definitionSnapshot: optional(text({ max: 400000 })),
    limits: optional(limitsCheck),
    checkpoints: optional(list(checkpointCheck, { max: 40 })),
    localActions: optional(list(executionLocalActionCheck, { max: 40 })),
  },
  { strict: true },
);
const runCheck = shape(
  {
    allowance: optional(executionAllowanceCheck),
    allowanceExtensions: optional(
      list(executionAllowanceAuditCheck, { max: 100 }),
    ),
    id,
    submissionKey: text({ min: 1, max: 1000 }),
    subject: executionSubjectCheck,
    projectId: id,
    teamId: id,
    context: text({ max: 160000 }),
    invocations: list(invocationCheck, { max: 100 }),
    cursor: number({ min: 0, max: 100, integer: true }),
    state: oneOf([
      "queued",
      "running",
      "publishing",
      "attention",
      "waiting-human",
      "completed",
      "cancelled",
    ] as const),
    attempts: list(attemptCheck, { max: 200 }),
    artifacts: list(artifactCheck, { max: 100 }),
    createdAt: timestamp,
    updatedAt: timestamp,
    reason: optional(text({ max: 2000 })),
    pauseRequested: optional(boolean),
    definitionSnapshot: optional(text({ max: 400000 })),
    limits: optional(limitsCheck),
    checkpoints: optional(list(checkpointCheck, { max: 40 })),
    activeCheckpointId: optional(id),
    hasGaps: optional(boolean),
    sourceAcknowledgement: optional(
      shape({ revision: id, acknowledgedAt: timestamp }, { strict: true }),
    ),
    projectionDestinations: optional(ids),
    projectionTarget: optional(
      shape({ sourceId: id, acknowledgedAt: timestamp }, { strict: true }),
    ),
    projectionRecovery: optional(
      shape(
        {
          resumeState: oneOf([
            "queued",
            "running",
            "publishing",
            "attention",
            "waiting-human",
            "completed",
            "cancelled",
          ] as const),
          pendingArtifactIds: ids,
          reason: optional(text({ max: 2000 })),
        },
        { strict: true },
      ),
    ),
    localActions: optional(list(executionLocalActionCheck, { max: 40 })),
    timing: optional(
      shape(
        {
          usedMs: number({
            min: 0,
            max: Number.MAX_SAFE_INTEGER,
            integer: true,
          }),
          scopes: list(
            shape(
              {
                id,
                usedMs: number({
                  min: 0,
                  max: Number.MAX_SAFE_INTEGER,
                  integer: true,
                }),
              },
              { strict: true },
            ),
            { max: 100 },
          ),
          active: optional(
            shape(
              {
                token: id,
                scopeId: optional(id),
                reservedMs: number({ min: 0, max: 1000, integer: true }),
                accountedMs: optional(
                  number({
                    min: 0,
                    max: Number.MAX_SAFE_INTEGER,
                    integer: true,
                  }),
                ),
              },
              { strict: true },
            ),
          ),
          parallel: optional(
            list(
              shape(
                {
                  token: id,
                  scopeId: optional(id),
                  reservedMs: number({ min: 0, max: 1000, integer: true }),
                  accountedMs: optional(
                    number({
                      min: 0,
                      max: Number.MAX_SAFE_INTEGER,
                      integer: true,
                    }),
                  ),
                },
                { strict: true },
              ),
              { max: 100 },
            ),
          ),
        },
        { strict: true },
      ),
    ),
    localActionEvidence: optional(
      list(
        shape(
          { id, completedAt: timestamp, messageIds: ids },
          { strict: true },
        ),
        { max: 40 },
      ),
    ),
    checkpointEvidence: optional(
      list(
        shape(
          {
            id,
            checkedIds: ids,
            note: text({ max: 3000 }),
            completedAt: timestamp,
          },
          { strict: true },
        ),
        { max: 40 },
      ),
    ),
  },
  { strict: true },
);
export function executionRunCheck(value: unknown): ExecutionRun {
  if (workflowSerializedSize(value) > EXECUTION_RUN_BYTES)
    throw new Error(
      "Execution run exceeds its evidence limit; export retained evidence.",
    );
  const run = runCheck(value);
  assertExecutionRunConsistency(run);
  return run;
}
export function executionSourceRevisionAccepted(
  run: ExecutionRun,
  currentRevision: string,
): boolean {
  return (
    currentRevision === run.subject.revision ||
    currentRevision === run.sourceAcknowledgement?.revision
  );
}
export function executionJournalCheck(value: unknown): ExecutionJournal {
  if (workflowSerializedSize(value) > EXECUTION_JOURNAL_BYTES)
    throw new Error("Execution journal is full; no evidence was discarded.");
  const result = shape(
    {
      format: oneOf(["coforge-execution/v2"] as const),
      revision: number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER }),
      runs: list(executionRunCheck, { max: 500 }),
      submissions: list(
        shape(
          { key: text({ min: 1, max: 1000 }), runId: id },
          { strict: true },
        ),
        { max: 10000 },
      ),
      messaging: optional(executionMessagingStateCheck),
      cancelledRunIds: optional(list(id, { max: 10000 })),
      projections: optional(
        list(
          shape(
            { sourceId: id, artifactId: id, blockHash: id },
            { strict: true },
          ),
          { max: 10000 },
        ),
      ),
    },
    { strict: true },
  )(value);
  if (
    new Set(result.runs.map((run) => run.id)).size !== result.runs.length ||
    new Set(result.submissions.map((item) => item.key)).size !==
      result.submissions.length ||
    result.runs.some(
      (run) =>
        !result.submissions.some(
          (item) => item.key === run.submissionKey && item.runId === run.id,
        ),
    )
  )
    throw new Error("Execution journal has inconsistent admission identities.");
  if (
    new Set(
      result.projections?.map((item) => `${item.sourceId}:${item.artifactId}`),
    ).size !== (result.projections?.length ?? 0)
  )
    throw new Error(
      "Projection replay tombstones contain duplicate identities.",
    );
  return result;
}
