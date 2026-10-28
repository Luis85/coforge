import { describe, expect, it } from "vitest";
import {
  createTeamMessage,
  selectTeamContext,
  type MessageAuthority,
  type TeamMessage,
} from "../../../features/coforge/domain/team-messages";
import {
  TeamMessageService,
  type MessageOutboxEntry,
} from "../../../features/coforge/application/team-message-service";

function authority(): MessageAuthority {
  return {
    rootId: "root",
    runId: "run",
    attemptId: "attempt",
    senderId: "agent-a",
    projectId: "CFP-001",
    teamId: "team",
    threadId: "thread",
    now: "2026-10-28T12:00:00Z",
    depth: 0,
    activeAncestors: ["agent-a"],
    allowedRecipients: ["agent-b", "council"],
    deadline: "2026-10-28T13:00:00Z",
    stopped: false,
    limits: { depth: 3, descendants: 5, messages: 10, invocations: 8 },
    usage: { descendants: 0, messages: 0, invocations: 0 },
    recipients: [
      {
        id: "agent-b",
        kind: "agent",
        projectId: "CFP-001",
        teamId: "team",
        enabled: true,
        expectedInvocations: 1,
      },
      {
        id: "council",
        kind: "council",
        projectId: "CFP-001",
        teamId: "team",
        enabled: true,
        expectedInvocations: 6,
      },
    ],
  };
}
const draft = {
  purpose: "request",
  recipientId: "agent-b",
  body: "Please inspect this proposal.",
};
describe("trusted bounded team messaging", () => {
  it("reserves a known workflow with no AI invocations without fabricating calls, while direct agents still require one", () => {
    const current = authority();
    current.allowedRecipients = ["workflow"];
    current.recipients = [
      {
        id: "workflow",
        kind: "workflow",
        projectId: "CFP-001",
        teamId: "team",
        enabled: true,
        expectedInvocations: 0,
      },
    ];
    expect(
      createTeamMessage({ ...draft, recipientId: "workflow" }, current, 0),
    ).toMatchObject({ startsRun: true, reservedInvocations: 0 });
    current.recipients = [{ ...current.recipients[0]!, kind: "agent" }];
    expect(() =>
      createTeamMessage({ ...draft, recipientId: "workflow" }, current, 0),
    ).toThrow();
  });
  it("assigns provenance outside model text and rejects forged fields or unauthorized recipients", () => {
    const message = createTeamMessage(draft, authority(), 0);
    expect(message).toMatchObject({
      senderId: "agent-a",
      rootId: "root",
      runId: "run",
      attemptId: "attempt",
      depth: 1,
      recipientId: "agent-b",
    });
    expect(() =>
      createTeamMessage({ ...draft, senderId: "operator" }, authority(), 0),
    ).toThrow();
    expect(() =>
      createTeamMessage({ ...draft, recipientId: "unknown" }, authority(), 0),
    ).toThrow("recipient");
    const ancestor = {
      ...authority(),
      allowedRecipients: ["agent-a"],
      recipients: [{ ...authority().recipients[0]!, id: "agent-a" }],
    };
    expect(() =>
      createTeamMessage({ ...draft, recipientId: "agent-a" }, ancestor, 0),
    ).toThrow("ancestor");
  });
  it("inherits root invocation/depth/deadline budgets and cannot hide council expansion", () => {
    const current = authority();
    current.usage.invocations = 3;
    expect(() =>
      createTeamMessage({ ...draft, recipientId: "council" }, current, 0),
    ).toThrow("invocation");
    expect(() =>
      createTeamMessage(draft, { ...authority(), depth: 3 }, 0),
    ).toThrow("depth");
    expect(() =>
      createTeamMessage(
        draft,
        { ...authority(), now: "2026-10-28T14:00:00Z" },
        0,
      ),
    ).toThrow("deadline");
    expect(() =>
      createTeamMessage(draft, { ...authority(), stopped: true }, 0),
    ).toThrow("stopped");
  });
  it("keeps information and replies inert, context scoped and bounded with explicit omissions", () => {
    const info = createTeamMessage(
      { ...draft, purpose: "information" },
      authority(),
      0,
    );
    const reply = createTeamMessage(
      { ...draft, purpose: "reply", replyTo: "parent" },
      {
        ...authority(),
        replyMessages: [
          {
            ...info,
            id: "parent",
            senderId: "agent-b",
            recipientId: "agent-a",
          },
        ],
      },
      1,
    );
    expect(() =>
      createTeamMessage(
        { ...draft, purpose: "reply", replyTo: "forged" },
        authority(),
        1,
      ),
    ).toThrow("provenance");
    expect(info.startsRun).toBe(false);
    expect(reply.startsRun).toBe(false);
    const messages = Array.from({ length: 12 }, (_, index) => ({
      ...info,
      id: `m${index}`,
      createdAt: `2026-10-28T12:${String(index).padStart(2, "0")}:00Z`,
    }));
    const snapshot = selectTeamContext(
      [...messages, { ...info, id: "other-team", teamId: "other" }, reply],
      {
        teamId: "team",
        projectId: "CFP-001",
        pinned: [{ id: "pinned", markdown: "Pinned team guidance." }],
        maxCharacters: 5000,
      },
    );
    expect(snapshot.messages).toHaveLength(10);
    expect(snapshot.omittedMessageIds).toEqual(["m0", "m1"]);
    expect(snapshot.pinned[0]?.id).toBe("pinned");
    expect(() =>
      selectTeamContext(messages, {
        teamId: "team",
        projectId: "CFP-001",
        pinned: [{ id: "huge", markdown: "x".repeat(100) }],
        maxCharacters: 20,
      }),
    ).toThrow("Pinned");
  });
  it("commits stable outbox intents atomically and retries delivery without duplicate recipient work", async () => {
    const entries: MessageOutboxEntry[] = [];
    const delivered = new Set<string>();
    let fail = true;
    let runs = 0;
    const service = new TeamMessageService({
      commit: async (values) => {
        for (const value of values)
          if (!entries.some((item) => item.message.id === value.message.id))
            entries.push(structuredClone(value));
      },
      load: async () => structuredClone(entries),
      save: async (value) => {
        const index = entries.findIndex(
          (item) => item.message.id === value.message.id,
        );
        entries[index] = structuredClone(value);
      },
      allowed: async () => true,
      deliver: async (value) => {
        if (!delivered.has(value.message.id)) {
          delivered.add(value.message.id);
          if (value.message.startsRun) runs++;
        }
        if (fail) {
          fail = false;
          throw new Error("After note/admission commit");
        }
      },
    });
    await service.enqueue([draft], authority());
    await service.enqueue([draft], authority());
    expect(entries).toHaveLength(1);
    await service.flush();
    expect(entries[0]?.status).toBe("pending");
    await service.flush();
    expect(entries[0]?.status).toBe("delivered");
    expect(runs).toBe(1);
  });
  it("does not commit part of an invalid batch or exceed limits by batching", async () => {
    const saved: TeamMessage[][] = [];
    const service = new TeamMessageService({
      commit: async (entries) => {
        saved.push(entries.map((item) => item.message));
      },
      load: async () => [],
      save: async () => undefined,
      allowed: async () => true,
      deliver: async () => undefined,
    });
    await expect(
      service.enqueue(
        [draft, { ...draft, recipientId: "unknown" }],
        authority(),
      ),
    ).rejects.toThrow();
    expect(saved).toEqual([]);
    const current = authority();
    current.limits.invocations = 1;
    await expect(service.enqueue([draft, draft], current)).rejects.toThrow(
      "invocation",
    );
    expect(saved).toEqual([]);
  });
});
