import { list, number, oneOf, optional, shape, text, timestamp } from "./check";
import type { ExecutionRun } from "./execution-types";
export interface ExecutionAllowance {
  maxInvocations: number;
  executionLimitMs: number;
  scopeLimits: { id: string; limitMs: number }[];
}
export interface ExecutionAllowancePatch {
  additionalInvocations?: number;
  additionalExecutionMs?: number;
  scopeId?: string;
  reason: string;
}
export interface ExecutionAllowanceAudit {
  id: string;
  operator: "streamer";
  at: string;
  reason: string;
  before: ExecutionAllowance;
  after: ExecutionAllowance;
  rootId: string;
  rootBefore: { maxInvocations: number; executionLimitMs: number };
  rootAfter: { maxInvocations: number; executionLimitMs: number };
}
const id = text({ min: 1, max: 200, pattern: /^[\w.:/-]+$/ });
const calls = number({ integer: true, min: 1, max: 100 });
const millis = number({ integer: true, min: 1, max: 7200000 });
export const executionAllowanceCheck = shape(
  {
    maxInvocations: calls,
    executionLimitMs: millis,
    scopeLimits: list(shape({ id, limitMs: millis }, { strict: true }), {
      max: 100,
    }),
  },
  { strict: true },
);
export const executionAllowanceAuditCheck = shape(
  {
    id,
    operator: oneOf(["streamer"] as const),
    at: timestamp,
    reason: text({ min: 1, max: 2000 }),
    before: executionAllowanceCheck,
    after: executionAllowanceCheck,
    rootId: id,
    rootBefore: shape(
      { maxInvocations: calls, executionLimitMs: millis },
      { strict: true },
    ),
    rootAfter: shape(
      { maxInvocations: calls, executionLimitMs: millis },
      { strict: true },
    ),
  },
  { strict: true },
);
export const executionAllowancePatchCheck = shape(
  {
    additionalInvocations: optional(calls),
    additionalExecutionMs: optional(millis),
    scopeId: optional(id),
    reason: text({ min: 1, max: 2000, trim: true }),
  },
  { strict: true },
);
export function effectiveExecutionAllowance(
  run: ExecutionRun,
): ExecutionAllowance {
  const scopes = new Map<string, { id: string; limitMs: number }>();
  for (const invocation of run.invocations)
    if (invocation.executionScope)
      scopes.set(invocation.executionScope.id, invocation.executionScope);
  return structuredClone(
    run.allowance ?? {
      maxInvocations: run.limits?.maxInvocations ?? 100,
      executionLimitMs: run.limits?.executionLimitMs ?? 900000,
      scopeLimits: [...scopes.values()],
    },
  );
}
