import { describe, expect, it } from "vitest";
import {
  ExecutionKernel,
  type ExecutionKernelHost,
} from "../../../features/coforge/application/execution-kernel";
import {
  emptyExecutionJournal,
  type ExecutionJournal,
} from "../../../features/coforge/domain/execution-run";
import {
  commitExecutionMessages,
  emptyExecutionMessagingState,
} from "../../../features/coforge/domain/execution-outbox";
import type { MessageAuthority } from "../../../features/coforge/domain/team-messages";

function fixture(
  failure: "before-response-commit" | "after-response-commit" | "none",
) {
  let disk = emptyExecutionJournal();
  let saves = 0;
  let calls = 0;
  let publications = 0;
  const authority: MessageAuthority = {
    rootId: "run",
    runId: "run",
    attemptId: "attempt",
    senderId: "agent-a",
    teamId: "team",
    projectId: "project",
    threadId: "thread",
    now: "2026-10-28T12:00:00Z",
    deadline: "2026-10-28T13:00:00Z",
    stopped: false,
    depth: 0,
    activeAncestors: ["agent-a"],
    allowedRecipients: ["agent-b"],
    limits: { depth: 3, messages: 10, descendants: 5, invocations: 10 },
    usage: { messages: 0, descendants: 0, invocations: 1 },
    recipients: [
      {
        id: "agent-b",
        kind: "agent",
        teamId: "team",
        projectId: "project",
        enabled: true,
        expectedInvocations: 1,
      },
    ],
  };
  const host: ExecutionKernelHost = {
    journal: {
      load: async () => structuredClone(disk),
      save: async (next) => {
        saves++;
        if (saves === 3 && failure === "before-response-commit")
          throw new Error("Storage interrupted before commit.");
        disk = structuredClone(next);
        if (saves === 3 && failure === "after-response-commit")
          throw new Error("Storage acknowledgement interrupted.");
      },
    },
    now: () => authority.now,
    id: () => "attempt",
    assertEligible: async () => undefined,
    resolveInvocation: () => ({
      prompt: "Captured source only.",
      inputArtifactIds: [],
    }),
    invoke: async () => {
      calls++;
      return {
        markdown: "Saved opinion.",
        simulated: true,
        messageDrafts: [
          {
            purpose: "request",
            recipientId: "agent-b",
            body: "Inspect this result.",
          },
        ],
      };
    },
    commitMessages: (journal, _run, _attempt, drafts) => {
      journal.messaging = commitExecutionMessages(
        journal.messaging ?? emptyExecutionMessagingState(),
        authority,
        drafts,
      );
    },
    publish: async () => {
      publications++;
    },
  };
  const kernel = new ExecutionKernel(host);
  return {
    host,
    kernel,
    authority,
    get disk(): ExecutionJournal {
      return disk;
    },
    get calls() {
      return calls;
    },
    get publications() {
      return publications;
    },
  };
}
async function start(kernel: ExecutionKernel): Promise<void> {
  await kernel.load();
  await kernel.admit({
    id: "run",
    submissionKey: "key",
    subject: {
      kind: "note",
      sourceId: "source",
      revision: "rev",
      markdown: "Human source",
    },
    projectId: "project",
    teamId: "team",
    context: "",
    invocations: [
      {
        id: "opinion",
        roundId: "opinions",
        agentId: "agent-a",
        agentRevision: "r1",
        provider: "demo",
        model: "demo",
        instructions: "Inspect.",
        access: "none",
        inputRoundIds: [],
      },
    ],
  });
  kernel.resume();
}
describe("atomic response and outgoing message evidence", () => {
  it("retains neither response nor message when their shared transaction was not committed", async () => {
    const f = fixture("before-response-commit");
    await start(f.kernel);
    await expect(f.kernel.step("run")).rejects.toThrow("before commit");
    expect(f.disk.runs[0]?.artifacts).toEqual([]);
    expect(f.disk.messaging?.outbox ?? []).toEqual([]);
    const recovered = new ExecutionKernel(f.host);
    await recovered.load();
    expect(recovered.snapshot().runs[0]?.state).toBe("attention");
    expect(f.calls).toBe(1);
    recovered.resume();
    await expect(recovered.step("run")).rejects.toThrow("attention");
    expect(f.calls).toBe(1);
  });
  it("recovers both committed response and message after a lost acknowledgement without another model call", async () => {
    const f = fixture("after-response-commit");
    await start(f.kernel);
    await expect(f.kernel.step("run")).rejects.toThrow("acknowledgement");
    expect(f.disk.runs[0]?.artifacts).toHaveLength(1);
    expect(f.disk.messaging?.outbox).toHaveLength(1);
    expect(f.disk.messaging?.roots[0]?.usage).toEqual({
      messages: 1,
      descendants: 1,
      invocations: 2,
    });
    const recovered = new ExecutionKernel(f.host);
    await recovered.load();
    await recovered.repair("run");
    expect(f.calls).toBe(1);
    expect(f.publications).toBe(1);
    expect(f.disk.runs[0]?.state).toBe("completed");
    expect(f.disk.messaging?.outbox[0]?.status).toBe("pending");
  });
  it("retains a valid contribution while rejecting unauthorized outgoing messages atomically", async () => {
    const f = fixture("none");
    f.authority.allowedRecipients = [];
    await start(f.kernel);
    await f.kernel.step("run");
    expect(f.disk.runs[0]?.artifacts[0]).toMatchObject({
      markdown: "Saved opinion.",
      messagesRejected: true,
    });
    expect(f.disk.messaging?.outbox ?? []).toEqual([]);
    expect(f.disk.runs[0]?.state).toBe("completed");
  });
});
