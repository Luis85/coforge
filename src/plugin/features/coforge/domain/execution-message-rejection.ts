export const MESSAGE_REJECTION_CODES = [
  "cancelled",
  "unavailable",
  "recipient-policy",
  "lineage",
  "budget",
  "message-expired",
  "root-stopped",
  "invalid-draft",
  "policy-rejected",
] as const;
export const MESSAGE_REJECTION_REASONS = {
  cancelled:
    "Outgoing messages were blocked because this run or an ancestor was cancelled. The response remains available for inspection.",
  unavailable:
    "Outgoing messages are unavailable on this host. The response and proposed drafts were retained.",
  "recipient-policy":
    "A proposed recipient is outside the current team/project grants or is unavailable. Review the logical destination and permissions.",
  lineage:
    "The proposed message violates trusted lineage, reply provenance or active ancestor rules. Review the original conversation.",
  budget:
    "The proposed batch exceeds an inherited invocation, message, descendant or depth limit. Review the remaining allowance; another message cannot reset it.",
  "message-expired":
    "The explicit message expiry deadline elapsed. Retained results remain available; review the delivery policy before requesting new work.",
  "root-stopped":
    "The root conversation was stopped. Future outgoing messages remain blocked while retained results stay available.",
  "invalid-draft":
    "The proposed message draft does not match the supported message contract. Review its purpose, body and logical recipient.",
  "policy-rejected":
    "The outgoing batch was rejected by current routing, provenance or root limits. Review the retained drafts and policy before requesting new work.",
} as const;
export type ExecutionMessageRejectionCode =
  keyof typeof MESSAGE_REJECTION_REASONS;
export interface ExecutionMessageRejectionInfo {
  code: ExecutionMessageRejectionCode;
  reason: string;
}
export class ExecutionMessageRejection extends Error {
  constructor(readonly code: ExecutionMessageRejectionCode) {
    super(MESSAGE_REJECTION_REASONS[code]);
    this.name = "ExecutionMessageRejection";
  }
}
export function messageRejectionInfo(
  error: unknown,
): ExecutionMessageRejectionInfo {
  const code =
    error instanceof ExecutionMessageRejection ? error.code : "policy-rejected";
  return { code, reason: MESSAGE_REJECTION_REASONS[code] };
}
