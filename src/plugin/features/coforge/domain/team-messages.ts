import { ExecutionMessageRejection } from "./execution-message-rejection";
import { number, oneOf, optional, shape, text, timestamp } from "./check";
import { contextEventId } from "./integrity";

export interface MessageRecipient {
  id: string;
  kind: "agent" | "council" | "workflow" | "team";
  projectId: string;
  teamId: string;
  enabled: boolean;
  expectedInvocations: number;
}
export interface MessageLimits {
  depth: number;
  descendants: number;
  messages: number;
  invocations: number;
}
export interface MessageUsage {
  descendants: number;
  messages: number;
  invocations: number;
}
export interface MessageAuthority {
  rootId: string;
  runId: string;
  attemptId: string;
  senderId: string;
  projectId: string;
  teamId: string;
  threadId: string;
  now: string;
  deadline?: string;
  depth: number;
  activeAncestors: readonly string[];
  allowedRecipients: readonly string[];
  stopped: boolean;
  limits: MessageLimits;
  usage: MessageUsage;
  recipients: readonly MessageRecipient[];
  replyMessages?: readonly TeamMessage[];
  actingRecipientIds?: readonly string[];
}
export interface TeamMessage {
  id: string;
  purpose: "request" | "information" | "reply";
  recipientId: string;
  body: string;
  replyTo?: string;
  rootId: string;
  runId: string;
  attemptId: string;
  senderId: string;
  projectId: string;
  teamId: string;
  threadId: string;
  createdAt: string;
  depth: number;
  startsRun: boolean;
  reservedInvocations: number;
}
export interface TeamMessageDraft {
  purpose: "request" | "information" | "reply";
  recipientId: string;
  body: string;
  replyTo?: string;
}
export interface MessageOutboxEntry {
  message: TeamMessage;
  status: "pending" | "delivered" | "blocked";
  attempts: number;
  reason?: string;
}
const identity = text({
  min: 1,
  max: 200,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u,
});
export const teamMessageDraftCheck = shape(
  {
    purpose: oneOf(["request", "information", "reply"]),
    recipientId: identity,
    body: text({ min: 1, max: 16000, trim: true }),
    replyTo: optional(identity),
  },
  { strict: true },
);
const count = number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER });
export const teamMessageId = (
  authority: Pick<MessageAuthority, "rootId" | "runId" | "attemptId">,
  index: number,
): string =>
  `msg-${contextEventId(JSON.stringify([authority.rootId, authority.runId, authority.attemptId, index]))}`;
/** Only the draft crosses the model boundary. Authority must come from the captured host invocation. */
export function createTeamMessage(
  draft: unknown,
  authority: MessageAuthority,
  index: number,
): TeamMessage {
  let parsed: TeamMessageDraft;
  try {
    parsed = teamMessageDraftCheck(draft);
  } catch {
    throw new ExecutionMessageRejection("invalid-draft");
  }
  count(index);
  timestamp(authority.now);
  if (authority.deadline !== undefined) timestamp(authority.deadline);
  if (authority.stopped) throw new ExecutionMessageRejection("root-stopped");
  if (
    authority.deadline !== undefined &&
    Date.parse(authority.now) >= Date.parse(authority.deadline)
  )
    throw new ExecutionMessageRejection("message-expired");
  for (const value of [
    ...Object.values(authority.limits),
    ...Object.values(authority.usage),
    authority.depth,
  ])
    count(value);
  if (!authority.allowedRecipients.includes(parsed.recipientId))
    throw new ExecutionMessageRejection("recipient-policy");
  const recipient = authority.recipients.find(
    (item) => item.id === parsed.recipientId,
  );
  if (
    !recipient ||
    !recipient.enabled ||
    recipient.projectId !== authority.projectId ||
    recipient.teamId !== authority.teamId
  )
    throw new ExecutionMessageRejection("recipient-policy");
  const startsRun = parsed.purpose === "request";
  if (startsRun && authority.activeAncestors.includes(recipient.id))
    throw new ExecutionMessageRejection("lineage");
  if (startsRun && recipient.kind === "team")
    throw new ExecutionMessageRejection("recipient-policy");
  if (parsed.purpose === "reply" && !parsed.replyTo)
    throw new ExecutionMessageRejection("lineage");
  if (parsed.purpose === "reply") {
    const original = authority.replyMessages?.find(
      (message) => message.id === parsed.replyTo,
    );
    if (
      !original ||
      original.rootId !== authority.rootId ||
      original.threadId !== authority.threadId ||
      original.teamId !== authority.teamId ||
      original.projectId !== authority.projectId ||
      original.senderId !== parsed.recipientId ||
      !(authority.actingRecipientIds ?? [authority.senderId]).includes(
        original.recipientId,
      )
    )
      throw new ExecutionMessageRejection("lineage");
  }
  const depth = authority.depth + (startsRun ? 1 : 0);
  const invocationCount = startsRun ? count(recipient.expectedInvocations) : 0;
  if (startsRun && invocationCount < 1 && recipient.kind !== "workflow")
    throw new ExecutionMessageRejection("recipient-policy");
  if (depth > authority.limits.depth)
    throw new ExecutionMessageRejection("budget");
  if (authority.usage.messages + 1 > authority.limits.messages)
    throw new ExecutionMessageRejection("budget");
  if (
    authority.usage.descendants + (startsRun ? 1 : 0) >
    authority.limits.descendants
  )
    throw new ExecutionMessageRejection("budget");
  if (
    authority.usage.invocations + invocationCount >
    authority.limits.invocations
  )
    throw new ExecutionMessageRejection("budget");
  return {
    ...parsed,
    id: teamMessageId(authority, index),
    rootId: authority.rootId,
    runId: authority.runId,
    attemptId: authority.attemptId,
    senderId: authority.senderId,
    projectId: authority.projectId,
    teamId: authority.teamId,
    threadId: authority.threadId,
    createdAt: authority.now,
    depth,
    startsRun,
    reservedInvocations: invocationCount,
  };
}

export interface PinnedTeamNote {
  id: string;
  markdown: string;
}
export interface TeamContextSelection {
  pinned: PinnedTeamNote[];
  messages: TeamMessage[];
  omittedMessageIds: string[];
  characters: number;
}
/** A frozen selection; subsequent messages enter subsequent runs only. No silent truncation. */
export function selectTeamContext(
  messages: readonly TeamMessage[],
  policy: {
    teamId: string;
    projectId: string;
    pinned: readonly PinnedTeamNote[];
    maxCharacters: number;
    recentLimit?: number;
  },
): TeamContextSelection {
  count(policy.maxCharacters);
  const limit = count(policy.recentLimit ?? 10);
  if (limit > 100)
    throw new Error("Recent team context is limited to 100 messages.");
  let characters = policy.pinned.reduce(
    (total, item) => total + item.markdown.length,
    0,
  );
  if (characters > policy.maxCharacters)
    throw new Error(
      "Pinned team context exceeds the context allowance. Select fewer sources or increase the explicit allowance.",
    );
  const eligible = messages.filter(
    (message) =>
      message.projectId === policy.projectId &&
      message.teamId === policy.teamId &&
      message.purpose === "information",
  );
  const ordered = [...eligible].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const selected: TeamMessage[] = [];
  const omitted = new Set<string>();
  for (const message of ordered.reverse()) {
    if (
      selected.length >= limit ||
      characters + message.body.length > policy.maxCharacters
    ) {
      omitted.add(message.id);
      continue;
    }
    selected.push(message);
    characters += message.body.length;
  }
  return {
    pinned: structuredClone([...policy.pinned]),
    messages: structuredClone(selected.reverse()),
    omittedMessageIds: eligible
      .filter((message) => omitted.has(message.id))
      .map((message) => message.id),
    characters,
  };
}
