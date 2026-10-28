import { describe, expect, it } from "vitest";
import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
  executionMessagingStateCheck,
} from "../../../features/coforge/domain/execution-outbox";
import type {
  MessageAuthority,
  TeamMessageDraft,
} from "../../../features/coforge/domain/team-messages";

const draft: TeamMessageDraft = {
  purpose: "request",
  recipientId: "agent-b",
  body: "Review this.",
};
function authority(): MessageAuthority {
  return {
    rootId: "root",
    runId: "root",
    attemptId: "attempt",
    senderId: "agent-a",
    projectId: "project",
    teamId: "team",
    threadId: "thread",
    now: "2026-10-28T12:00:00Z",
    depth: 0,
    activeAncestors: ["agent-a"],
    allowedRecipients: ["agent-b"],
    deadline: "2026-10-28T13:00:00Z",
    stopped: false,
    limits: { depth: 3, descendants: 2, messages: 2, invocations: 2 },
    usage: { descendants: 0, messages: 0, invocations: 1 },
    recipients: [
      {
        id: "agent-b",
        kind: "agent",
        projectId: "project",
        teamId: "team",
        enabled: true,
        expectedInvocations: 1,
      },
    ],
  };
}
describe("artifact-atomic message outbox and root reservations", () => {
  it("keeps shared root counters and idempotent intents without double reservation on replay", () => {
    const initial = emptyExecutionMessagingState();
    const current = authority();
    const saved = commitExecutionMessages(initial, current, [draft]);
    expect(initial).toEqual(emptyExecutionMessagingState());
    expect(saved.roots[0]?.usage).toEqual({
      messages: 1,
      descendants: 1,
      invocations: 2,
    });
    expect(
      commitExecutionMessages(
        saved,
        { ...current, now: "2026-10-28T14:00:00Z" },
        [draft],
      ),
    ).toEqual(saved);
    expect(() =>
      commitExecutionMessages(
        saved,
        {
          ...current,
          runId: "child",
          attemptId: "child-attempt",
          usage: { messages: 0, descendants: 0, invocations: 0 },
          limits: {
            depth: 10,
            messages: 100,
            invocations: 100,
            descendants: 100,
          },
        },
        [draft],
      ),
    ).toThrow("invocation");
  });
  it("rejects partial batches atomically and never permits descendants to invent a root", () => {
    const state = emptyExecutionMessagingState();
    expect(() =>
      commitExecutionMessages(state, authority(), [draft, draft]),
    ).toThrow("invocation");
    expect(state).toEqual(emptyExecutionMessagingState());
    expect(() =>
      commitExecutionMessages(state, { ...authority(), runId: "child" }, [
        draft,
      ]),
    ).toThrow("reset");
  });
  it("blocks reused result IDs with different content and inconsistent persisted provenance", () => {
    const state = commitExecutionMessages(
      emptyExecutionMessagingState(),
      authority(),
      [draft],
    );
    expect(() =>
      commitExecutionMessages(state, authority(), [
        { ...draft, body: "different" },
      ]),
    ).toThrow("different content");
    state.outbox[0]!.message.startsRun = false;
    expect(() => executionMessagingStateCheck(state)).toThrow("provenance");
  });
});
