import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilMessagingModule } from "../../../infrastructure/coforge/council-messaging-module";
import {
  ExecutionKernel,
  type ExecutionKernelHost,
} from "../../../features/coforge/application/execution-kernel";
import {
  CouncilCatalogue,
  type CouncilCatalogueSnapshot,
} from "../../../features/coforge/application/council-catalogue";
import {
  councilAdmission,
  councilDispatch,
  resolveCouncilPlan,
} from "../../../features/coforge/application/council-execution";
import { emptyExecutionJournal } from "../../../features/coforge/domain/execution-run";
import {
  definitionRevision,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
import { readCouncilSource } from "../../../infrastructure/coforge/council-source-notes";
import { compileWorkflowV2 } from "../../../features/coforge/application/workflow-v2-compiler";
import {
  workflowV2Admission,
  workflowV2Dispatch,
  isWorkflowV2Run,
} from "../../../features/coforge/application/workflow-v2-execution";
import { workflowV2DefinitionCheck } from "../../../features/coforge/domain/configured-workflow-v2";

afterEach(() => {
  vi.useRealTimers();
});
function fixture(workflowDestination = false) {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const agents: AgentDefinition[] = ["agent-a", "agent-b"].map((id) => ({
    schema: "agent/v1",
    id,
    name: id,
    enabled: true,
    role: "Reviewer",
    instructions: "Inspect and reply.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: true },
  }));
  const team: TeamDefinition = {
    schema: "team/v1",
    id: "team",
    name: "Team",
    enabled: true,
    projectId: "project",
    members: agents.map((item) => item.id),
    pinnedContext: [],
    recentMessages: 10,
    allowedRecipients: [
      "agent-a",
      "agent-b",
      "team",
      ...(workflowDestination ? ["project"] : []),
    ],
  };
  const snapshot: CouncilCatalogueSnapshot = {
    valid: [...agents, team].map((definition) => ({
      path: `${definition.id}.md`,
      definition,
      revision: definitionRevision(definition),
    })),
    invalid: [],
  };
  const catalogue = new CouncilCatalogue({
    scan: async () => structuredClone(snapshot),
    save: async () => undefined,
    open: async () => undefined,
  });
  let disk = emptyExecutionJournal();
  let calls = 0;
  let id = 0;
  const host: ExecutionKernelHost = {
    journal: {
      load: async () => structuredClone(disk),
      save: async (next) => {
        disk = structuredClone(next);
      },
    },
    now: () => new Date().toISOString(),
    id: () => `attempt-${++id}`,
    assertEligible: async (run) => messaging.assertRunAllowed(run),
    resolveInvocation: (run, invocation) =>
      isWorkflowV2Run(run)
        ? workflowV2Dispatch(run, invocation)
        : councilDispatch(run, invocation),
    invoke: async (run, invocation, attempt) => {
      await messaging.prepare(run, invocation, attempt);
      calls++;
      const parent = kernel
        .snapshot()
        .messaging?.outbox.find(
          (entry) => entry.message.id === run.subject.sourceId,
        )?.message;
      return {
        markdown: `Result from ${invocation.agentId}.`,
        simulated: true,
        messageDrafts: parent
          ? [
              {
                purpose: "reply",
                recipientId: parent.senderId,
                body: "Finished the requested review.",
                replyTo: parent.id,
              },
            ]
          : [
              {
                purpose: "request",
                recipientId: workflowDestination ? "project" : "agent-b",
                body: "Please independently inspect the proposal.",
              },
            ],
      };
    },
    publish: async () => undefined,
    commitMessages: (journal, _run, attempt, drafts) =>
      messaging.commit(journal, attempt, drafts),
  };
  const kernel = new ExecutionKernel(host);
  const messaging = new CouncilMessagingModule(
    plugin,
    kernel,
    catalogue,
    async () => undefined,
    async (target, path, key) => {
      const file = app.vault.getFileByPath(path)!;
      const source = readCouncilSource(
        await app.vault.read(file),
        path,
        kernel.snapshot().runs,
      );
      return kernel.admit(
        councilAdmission(
          {
            plan: resolveCouncilPlan(await catalogue.list(), target),
            context: "",
            source: {
              sourceId: source.sourceId!,
              generation: source.generation,
              revision: source.sourceRevision,
              markdown: source.body,
            },
            invocations: 1,
            warnings: [],
          },
          `child-${source.sourceId}`,
          key,
          {
            timeoutSeconds: 30,
            maxTurns: 1,
            maxBudgetUsd: 1,
            simulation: true,
          },
        ),
      );
    },
    workflowDestination
      ? {
          resolve: async (projectId, teamId) =>
            projectId === "project" && teamId === "team"
              ? {
                  id: "project",
                  kind: "workflow",
                  projectId,
                  teamId,
                  enabled: true,
                  expectedInvocations: 1,
                }
              : null,
          dispatch: async (projectId, path, key) => {
            const file = app.vault.getFileByPath(path)!;
            const note = readCouncilSource(
              await app.vault.read(file),
              path,
              kernel.snapshot().runs,
            );
            const definition = workflowV2DefinitionCheck({
              format: "coforge-workflow/v2",
              revision: "analysis-v1",
              name: "Analysis",
              teamId: "team",
              subjectMode: "note",
              collections: [],
              limits: {
                timeoutSeconds: 30,
                maxTurns: 1,
                maxBudgetUsd: 1,
                maxInvocations: 10,
              },
              steps: [
                {
                  id: "analysis",
                  name: "Analyze",
                  kind: "agent",
                  agentId: "agent-b",
                  instructions: "Inspect the request.",
                  output: "markdown",
                  access: "none",
                  inputs: [],
                },
              ],
            });
            const source = {
              sourceId: note.sourceId!,
              generation: note.generation,
              revision: note.sourceRevision,
              markdown: note.body,
            };
            const plan = compileWorkflowV2(
              definition,
              {
                kind: "note",
                sourceId: source.sourceId,
                revision: source.revision,
                markdown: source.markdown,
              },
              { projectId, team, agents, councils: [] },
            );
            await kernel.admit(
              workflowV2Admission(
                { plan, source, context: "", invocations: 1, warnings: [] },
                `workflow-${note.sourceId}`,
                key,
                false,
              ),
            );
          },
        }
      : undefined,
  );
  return {
    app,
    kit,
    kernel,
    messaging,
    snapshot,
    catalogue,
    get calls() {
      return calls;
    },
    async start() {
      await kernel.load();
      await kernel.admit(
        councilAdmission(
          {
            plan: resolveCouncilPlan(await catalogue.list(), {
              kind: "agent",
              id: "agent-a",
              teamId: "team",
            }),
            context: "",
            source: {
              sourceId: "source",
              generation: 0,
              revision: "revision",
              markdown: "Human source.",
            },
            invocations: 1,
            warnings: [],
          },
          "root",
          "submission",
          {
            timeoutSeconds: 30,
            maxTurns: 1,
            maxBudgetUsd: 1,
            simulation: true,
          },
        ),
      );
      kernel.resume();
    },
  };
}
describe("directed collaboration through the shared journal", () => {
  it("routes an allowed logical workflow recipient into one typed v2 run and keeps its reply inert", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const f = fixture(true);
    await f.start();
    await f.kernel.step("root");
    await f.messaging.service.flush();
    const child = f.kernel.snapshot().runs.find((run) => run.id !== "root")!;
    expect(isWorkflowV2Run(child)).toBe(true);
    await f.kernel.step(child.id);
    await f.messaging.service.flush();
    expect(f.kernel.snapshot().runs).toHaveLength(2);
    expect(f.calls).toBe(2);
    expect(
      f.messaging.service
        .messages()
        .map((entry) => [entry.message.purpose, entry.status]),
    ).toEqual([
      ["request", "delivered"],
      ["reply", "delivered"],
    ]);
  });
  it("delivers one directed request and an inert reply without invoking the sender again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const f = fixture();
    await f.start();
    await f.kernel.step("root");
    await f.messaging.service.flush();
    await f.messaging.service.flush();
    const child = f.kernel.snapshot().runs.find((run) => run.id !== "root")!;
    expect(child).toBeDefined();
    expect(f.kernel.snapshot().runs).toHaveLength(2);
    await f.kernel.step(child.id);
    await f.messaging.service.flush();
    const entries = f.messaging.service.messages();
    expect(
      entries.map((entry) => [entry.message.purpose, entry.status]),
    ).toEqual([
      ["request", "delivered"],
      ["reply", "delivered"],
    ]);
    expect(f.calls).toBe(2);
    expect(f.kernel.snapshot().runs).toHaveLength(2);
    expect(f.app.vault.getMarkdownFiles()).toHaveLength(2);
    expect(f.kit.errors).toEqual([]);
  });
  it("blocks a revoked recipient grant at delivery and stopping the root cancels its queued descendant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const f = fixture();
    await f.start();
    await f.kernel.step("root");
    const currentTeam = f.snapshot.valid.find(
      (item) => item.definition.schema === "team/v1",
    )!.definition;
    if (currentTeam.schema !== "team/v1") throw new Error("Expected team.");
    currentTeam.allowedRecipients = [];
    await f.messaging.service.flush();
    expect(f.messaging.service.messages()[0]?.status).toBe("blocked");
    expect(f.kernel.snapshot().runs).toHaveLength(1);
    expect(f.calls).toBe(1);
    const other = fixture();
    await other.start();
    await other.kernel.step("root");
    await other.messaging.service.flush();
    await other.messaging.stop("root");
    expect(
      other.kernel.snapshot().runs.find((run) => run.id !== "root")?.state,
    ).toBe("cancelled");
    expect(other.calls).toBe(1);
  });
});
