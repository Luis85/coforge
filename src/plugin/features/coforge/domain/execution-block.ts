export const EXECUTION_BLOCK_REASONS = {
  "execution-time":
    "The captured automatic execution allowance is exhausted. Queue, pause and human review time are excluded. Inspect retained results, then explicitly extend the allowance or start new work.",
  "source-draft":
    "The source is marked Draft. Mark it Ready before retrying this captured run.",
  "source-changed":
    "The source changed after admission. Review the captured input, then continue that snapshot or cancel and submit a new generation.",
  "project-paused":
    "Project execution is paused. Resume this project before continuing its queued work.",
  "member-revoked":
    "A required definition, member or capability is disabled or unavailable. Restore its explicit grant or cancel this run; captured prompts cannot restore permission.",
  "provider-unavailable":
    "The selected provider is unavailable or cannot enforce the required isolation. Restore its connection or start a new run with a supported provider.",
  "root-deadline":
    "The root execution deadline expired. Export the retained results and deliberately start a new submission if more work is needed.",
  "root-stopped":
    "The root conversation is stopped. Inspect retained work; future dispatch and message delivery remain blocked.",
  "source-missing":
    "The source note is missing or its identity is ambiguous. Restore its unique identity or explicitly reassign publication to a private recovery note.",
  "source-conflict":
    "A generated source-note block was edited. Preserve the human edit and recorded artifact, then repair or reassign publication without another provider call.",
  storage:
    "Evidence storage has no reserved result capacity. Export settled history or free vault storage, then explicitly retry; no provider was invoked.",
  "invocation-limit":
    "The captured or inherited invocation allowance cannot accommodate another attempt. Preserve the results and review the root limits before starting new work.",
} as const;
export type ExecutionBlockCode = keyof typeof EXECUTION_BLOCK_REASONS;
/** Only host policy creates typed blocks; untrusted Error.message is never a recovery instruction. */
export class ExecutionBlockError extends Error {
  constructor(readonly code: ExecutionBlockCode) {
    super(EXECUTION_BLOCK_REASONS[code]);
    this.name = "ExecutionBlockError";
  }
}
export function executionBlockReason(error: unknown, fallback: string): string {
  return error instanceof ExecutionBlockError
    ? EXECUTION_BLOCK_REASONS[error.code]
    : fallback;
}
