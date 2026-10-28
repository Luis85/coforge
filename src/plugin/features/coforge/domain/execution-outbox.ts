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
import {
  createTeamMessage,
  teamMessageId,
  type MessageAuthority,
  type MessageLimits,
  type MessageUsage,
  type MessageOutboxEntry,
  type TeamMessageDraft,
} from "./team-messages";

export interface ExecutionMessageRoot {
  id: string;
  projectId: string;
  teamId: string;
  deadline?: string;
  usedExecutionMs?: number;
  limitExecutionMs?: number;
  limits: MessageLimits;
  usage: MessageUsage;
  stopped: boolean;
}
export interface ExecutionMessagingState {
  roots: ExecutionMessageRoot[];
  outbox: MessageOutboxEntry[];
}
export const emptyExecutionMessagingState = (): ExecutionMessagingState => ({
  roots: [],
  outbox: [],
});
const id = text({
  min: 1,
  max: 200,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u,
});
const count = number({ min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
const limitsCheck = shape(
  { depth: count, descendants: count, messages: count, invocations: count },
  { strict: true },
);
const usageCheck = shape(
  { descendants: count, messages: count, invocations: count },
  { strict: true },
);
const messageCheck = shape(
  {
    id,
    purpose: oneOf(["request", "information", "reply"]),
    recipientId: id,
    body: text({ min: 1, max: 16000 }),
    replyTo: optional(id),
    rootId: id,
    runId: id,
    attemptId: id,
    senderId: id,
    projectId: id,
    teamId: id,
    threadId: id,
    createdAt: timestamp,
    depth: count,
    startsRun: boolean,
    reservedInvocations: count,
  },
  { strict: true },
);
const rootCheck = shape(
  {
    id,
    projectId: id,
    teamId: id,
    deadline: optional(timestamp),
    usedExecutionMs: optional(count),
    limitExecutionMs: optional(number({ min: 1, max: 7200000, integer: true })),
    limits: limitsCheck,
    usage: usageCheck,
    stopped: boolean,
  },
  { strict: true },
);
export function executionMessagingStateCheck(
  value: unknown,
): ExecutionMessagingState {
  const state = shape(
    {
      roots: list(rootCheck, { max: 500 }),
      outbox: list(
        shape(
          {
            message: messageCheck,
            status: oneOf(["pending", "delivered", "blocked"]),
            attempts: count,
            reason: optional(text({ max: 2000 })),
          },
          { strict: true },
        ),
        { max: 10000 },
      ),
    },
    { strict: true },
  )(value);
  if (
    new Set(state.roots.map((item) => item.id)).size !== state.roots.length ||
    new Set(state.outbox.map((item) => item.message.id)).size !==
      state.outbox.length
  )
    throw new Error("Messaging journal contains duplicate identities.");
  for (const entry of state.outbox) {
    const root = state.roots.find((item) => item.id === entry.message.rootId);
    if (
      !root ||
      root.projectId !== entry.message.projectId ||
      root.teamId !== entry.message.teamId ||
      entry.message.startsRun !== (entry.message.purpose === "request")
    )
      throw new Error(
        "Messaging journal contains inconsistent root provenance.",
      );
  }
  for (const root of state.roots)
    if (
      root.usage.descendants > root.limits.descendants ||
      root.usage.invocations > root.limits.invocations ||
      root.usage.messages > root.limits.messages
    )
      throw new Error("Messaging journal exceeds inherited root limits.");
  return state;
}
/** Called inside the same journal transaction that commits the producing result. No IO/provider work. */
export function commitExecutionMessages(
  previous: ExecutionMessagingState,
  authority: MessageAuthority,
  drafts: readonly TeamMessageDraft[],
): ExecutionMessagingState {
  const state = structuredClone(previous);
  if (drafts.length > 100)
    throw new Error("A result can propose at most 100 messages.");
  let root = state.roots.find((item) => item.id === authority.rootId);
  if (!root) {
    if (authority.rootId !== authority.runId)
      throw new Error(
        "A descendant cannot reset its missing root messaging limits.",
      );
    root = {
      id: authority.rootId,
      projectId: authority.projectId,
      teamId: authority.teamId,
      deadline: authority.deadline,
      limits: structuredClone(authority.limits),
      usage: structuredClone(authority.usage),
      stopped: authority.stopped,
    };
    state.roots.push(root);
  }
  if (
    root.projectId !== authority.projectId ||
    root.teamId !== authority.teamId
  )
    throw new Error(
      "Messaging root scope does not match the producing invocation.",
    );
  const current: MessageAuthority = {
    ...structuredClone(authority),
    deadline: root.deadline,
    limits: root.limits,
    usage: root.usage,
    stopped: root.stopped || authority.stopped,
  };
  for (const [index, draft] of drafts.entries()) {
    const existing = state.outbox.find(
      (item) => item.message.id === teamMessageId(authority, index),
    );
    if (existing) {
      if (
        existing.message.body !== draft.body.trim() ||
        existing.message.purpose !== draft.purpose ||
        existing.message.recipientId !== draft.recipientId ||
        existing.message.replyTo !== draft.replyTo
      )
        throw new Error(
          "A message delivery identity was reused with different content.",
        );
      continue;
    }
    const message = createTeamMessage(draft, current, index);
    root.usage.messages++;
    root.usage.descendants += message.startsRun ? 1 : 0;
    root.usage.invocations += message.reservedInvocations;
    state.outbox.push({ message, status: "pending", attempts: 0 });
  }
  return executionMessagingStateCheck(state);
}
