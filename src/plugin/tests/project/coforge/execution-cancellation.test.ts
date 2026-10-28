import { describe, expect, it } from "vitest";
import {
  ExecutionKernel,
  type ExecutionKernelHost,
} from "../../../features/coforge/application/execution-kernel";
import {
  emptyExecutionJournal,
  type ExecutionAdmission,
  type ExecutionResponse,
} from "../../../features/coforge/domain/execution-run";
import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
} from "../../../features/coforge/domain/execution-outbox";
import { ExecutionMessageRejection } from "../../../features/coforge/domain/execution-message-rejection";
import type {
  MessageAuthority,
  TeamMessageDraft,
} from "../../../features/coforge/domain/team-messages";
const at = "2026-10-28T12:00:00.000Z";
const input = (id: string, sourceId = id): ExecutionAdmission => ({
  id,
  submissionKey: id,
  projectId: "project",
  teamId: "team",
  context: "",
  subject: { kind: "note", sourceId, revision: "r1", markdown: "Request" },
  limits: {
    timeoutSeconds: 180,
    maxBudgetUsd: 1,
    maxTurns: 12,
    maxInvocations: 10,
    simulation: false,
  },
  invocations: [
    {
      id: "review",
      roundId: "review",
      agentId: id,
      agentRevision: "r1",
      provider: "claude",
      model: "sonnet",
      instructions: "Analyze",
      access: "none",
      inputRoundIds: [],
    },
  ],
});
function authority(
  runId: string,
  attemptId: string,
  allowance = 10,
): MessageAuthority {
  return {
    rootId: "parent",
    runId,
    attemptId,
    senderId: runId,
    projectId: "project",
    teamId: "team",
    threadId: "parent",
    now: at,
    deadline: "2026-10-28T13:00:00.000Z",
    depth: 0,
    activeAncestors: [],
    allowedRecipients: ["child", "grandchild", "team"],
    stopped: false,
    limits: { depth: 3, descendants: 10, messages: 10, invocations: allowance },
    usage: { descendants: 0, messages: 0, invocations: 1 },
    recipients: ["child", "grandchild", "team"].map((id) => ({
      id,
      kind: id === "team" ? "team" : "agent",
      projectId: "project",
      teamId: "team",
      enabled: true,
      expectedInvocations: id === "team" ? 0 : 1,
    })),
  };
}
function fixture() {
  let journal = emptyExecutionJournal();
  let ids = 0;
  const cancellations: string[] = [];
  const host: ExecutionKernelHost = {
    journal: {
      load: async () => journal,
      save: async (next) => {
        journal = structuredClone(next);
      },
    },
    now: () => at,
    id: () => `attempt-${++ids}`,
    assertEligible: async () => undefined,
    resolveInvocation: () => ({ prompt: "Request", inputArtifactIds: [] }),
    invoke: async () => ({ markdown: "Result", simulated: false }),
    publish: async () => undefined,
    cancelInvocation: (id) => {
      cancellations.push(id);
    },
  };
  const kernel = new ExecutionKernel(host);
  return {
    kernel,
    host,
    cancellations,
    get journal() {
      return journal;
    },
  };
}
describe("conversation cancellation and atomic message authority", () => {
  it("cancels queued descendants, blocks pending delivery and rejects late-provider message intents while retaining its result", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(input("parent"));
    await f.kernel.updateMessaging((previous) =>
      commitExecutionMessages(previous, authority("parent", "first"), [
        { purpose: "request", recipientId: "child", body: "Child request" },
      ]),
    );
    const childMessage = f.journal.messaging!.outbox[0]!.message;
    await f.kernel.admit(input("child", childMessage.id));
    await f.kernel.updateMessaging((previous) =>
      commitExecutionMessages(previous, authority("child", "second"), [
        {
          purpose: "request",
          recipientId: "grandchild",
          body: "Grandchild request",
        },
      ]),
    );
    const grandchildMessage = f.journal.messaging!.outbox[1]!.message;
    await f.kernel.admit(input("grandchild", grandchildMessage.id));
    let release: (value: ExecutionResponse) => void = () => undefined;
    let entered: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    f.host.invoke = async () =>
      new Promise((resolve) => {
        release = resolve;
        entered();
      });
    let commits = 0;
    f.host.commitMessages = () => {
      commits++;
    };
    f.kernel.resume();
    const active = f.kernel.step("parent");
    await ready;
    await f.kernel.cancel("parent");
    release({
      markdown: "Late result",
      simulated: false,
      messageDrafts: [
        { purpose: "information", recipientId: "team", body: "Late intent" },
      ],
    });
    await active;
    expect(f.journal.runs.map((run) => run.state)).toEqual([
      "cancelled",
      "cancelled",
      "cancelled",
    ]);
    expect(
      f.journal.messaging?.outbox.every((entry) => entry.status === "blocked"),
    ).toBe(true);
    expect(f.cancellations).toEqual(["parent"]);
    expect(commits).toBe(0);
    expect(f.journal.runs[0]?.artifacts[0]).toMatchObject({
      markdown: "Late result",
      messageRejection: { code: "cancelled" },
    });
    await expect(
      f.kernel.admit(input("late-child", childMessage.id)),
    ).rejects.toThrow("cancelled");
  });
  it("includes retries before the first outgoing response when creating a root and rejects overspending atomically", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(input("parent"));
    let calls = 0;
    const draft: TeamMessageDraft = {
      purpose: "request",
      recipientId: "child",
      body: "Request",
    };
    f.host.invoke = async () => {
      if (++calls === 1) throw new Error("Uncertain first attempt");
      return {
        markdown: "Second result",
        simulated: false,
        messageDrafts: [draft],
      };
    };
    f.host.commitMessages = (next, run, attempt, drafts) => {
      next.messaging = commitExecutionMessages(
        next.messaging ?? emptyExecutionMessagingState(),
        authority(run.id, attempt.id, 2),
        drafts,
      );
    };
    f.kernel.resume();
    await expect(f.kernel.step("parent")).rejects.toThrow("Uncertain");
    await f.kernel.retry("parent", true);
    await f.kernel.step("parent");
    expect(f.journal.messaging).toBeUndefined();
    expect(f.journal.runs[0]?.artifacts[0]).toMatchObject({
      markdown: "Second result",
      messageRejection: { code: "budget" },
    });
  });
  it("stores fixed typed rejection text and never persists a raw sensitive callback error", async () => {
    const f = fixture();
    await f.kernel.load();
    await f.kernel.admit(input("parent"));
    f.host.invoke = async () => ({
      markdown: "Result",
      simulated: false,
      messageDrafts: [
        { purpose: "information", recipientId: "team", body: "Context" },
      ],
    });
    f.host.commitMessages = () => {
      throw new ExecutionMessageRejection("recipient-policy");
    };
    f.kernel.resume();
    await f.kernel.step("parent");
    expect(f.journal.runs[0]?.artifacts[0]?.messageRejection).toMatchObject({
      code: "recipient-policy",
      reason: expect.stringContaining("current team/project grants"),
    });
    await f.kernel.admit(input('other'));
    f.host.commitMessages = () => { throw new Error('secret path C:/private/notes.md'); };
    await f.kernel.step('other');
    expect(f.journal.runs[1]?.artifacts[0]?.messageRejection?.code).toBe('policy-rejected');
    expect(JSON.stringify(f.journal)).not.toContain("secret path");
  });
});
