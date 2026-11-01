// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { toRaw } from "vue";
import IdeaWorkflowTab from "../../../presentation/components/coforge/IdeaWorkflowTab.vue";
import { createSeed } from "../../../features/coforge/domain/seed";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { workflowProposalRevision } from "../../../features/coforge/domain/configured-workflow-run";
import type { AgentJob } from "../../../features/coforge/domain/types";
import { workflowUiFixture } from "./workflow-ui-fixture";

async function fixture(durable = true) {
  const f = await workflowUiFixture();
  const now = Date.now();
  const at = new Date(now - 360001000).toISOString();
  const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  const definition = defaultWorkflowDefinition(f.project.settings);
  const build = definition.steps.find((step) => step.id === "implement");
  if (!build || build.kind !== "ai") throw new Error("Expected Build");
  build.provider = "claude";
  if (durable) build.execution = { mode: 'background', idleWarningSeconds: 1800, maxTurns: 50, maxBudgetUsd: 20 };
  const ref = {
    version: 1 as const,
    executionId: "existing-execution",
    workerId: "original-worker",
    epoch: 1,
    inputHash: "a".repeat(64),
  };
  const job: AgentJob = {
    id: "build-job",
    ideaId: idea.id,
    projectId: f.project.id,
    stage: "implement",
    status: "running",
    provider: "claude",
    model: "captured-sonnet",
    startedAt: at,
    logs: ["Original admission"],
    workflow: {
      runId: "original-run",
      definitionRevision: definition.revision,
      proposalRevision: workflowProposalRevision(idea),
      attemptId: "attempt",
      step: build,
      inputArtifacts: [],
    },
    ...(durable
      ? {
          durable: {
            intent: "start" as const,
            ref,
            policy: {
              mode: "background" as const,
              idleWarningSeconds: 1800,
              maxTurns: 50,
              maxBudgetUsd: 20,
            },
            snapshot: {
              version: 1 as const,
              ref,
              sequence: 3,
              phase: "running" as const,
              createdAt: at,
              startedAt: at,
              elapsedSeconds: 360001,
              lastContactAt: new Date(now - 20000).toISOString(),
              lastActivityAt: new Date(now - 7200000).toISOString(),
              logs: ["Observed activity"],
            },
          },
        }
      : {}),
  };
  idea.workflowRun = {
    id: "original-run",
    ideaId: idea.id,
    projectId: f.project.id,
    definition,
    proposalRevision: workflowProposalRevision(idea),
    revision: 1,
    cursor: 4,
    state: "running",
    attempts: [
      {
        id: "attempt",
        stepId: "implement",
        stepName: "Build",
        kind: "ai",
        status: "running",
        inputs: [],
        jobId: job.id,
        startedAt: at,
      },
    ],
    artifacts: [],
    createdAt: at,
    updatedAt: at,
    activeAttemptId: "attempt",
  };
  f.store.state!.ideas = [idea];
  f.store.state!.jobs = [job];
  f.store.select(idea.id, "workflow");
  const wrapper = mount(IdeaWorkflowTab, {
    props: { idea },
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  await flushPromises();
  return {
    ...f,
    wrapper,
    job: f.store.state!.jobs[0]!,
    close: async () => {
      wrapper.unmount();
      await f.dispose();
    },
  };
}

it("shows observed elapsed, contact and activity separately without invented progress or changing captured policy", async () => {
  const f = await fixture();
  try {
    const writes = f.storage.saves;
    const status = f.wrapper.get('[aria-label="Background Build status"]');
    expect(status.text()).toContain("100h");
    expect(status.text()).toContain("Last contact");
    expect(status.text()).toContain("Last activity");
    expect(status.text()).toContain("No activity has been reported");
    expect(status.text()).toContain("USD20");
    expect(status.text()).toContain("50");
    expect(status.text()).not.toMatch(/\d+%/);
    expect(status.text()).not.toContain("Build completed");
    expect(
      status
        .findAll("button")
        .some((button) => button.text() === "Check existing Build"),
    ).toBe(true);
    expect(
      status
        .findAll("button")
        .some((button) => /Restart|Start a new/.test(button.text())),
    ).toBe(false);
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});

it("distinguishes disconnection, cancellation uncertainty and a result awaiting canonical save", async () => {
  const f = await fixture();
  try {
    f.job.durable!.reconcileError = "Original worker is unreachable";
    await flushPromises();
    const status = () =>
      f.wrapper.get('[aria-label="Background Build status"]').text();
    expect(status()).toContain("Build synchronization needs attention");
    expect(status()).toContain("Last observed");
    expect(status()).toContain("Original worker is unreachable");
    expect(status()).not.toContain("Build failed");
    f.job.durable!.intent = "cancel";
    f.job.durable!.snapshot!.cancellationRequested = true;
    await flushPromises();
    expect(status()).toContain("Cancellation unconfirmed");
    delete f.job.durable!.reconcileError;
    f.job.durable!.snapshot!.phase = "running";
    await flushPromises();
    expect(status()).toContain("Cancellation requested");
    f.job.durable!.intent = "start";
    f.job.durable!.snapshot!.cancellationRequested = false;
    f.job.durable!.snapshot!.phase = "completed";
    await flushPromises();
    expect(status()).toContain("Result awaiting host save");
    expect(status()).not.toContain("Build completed");
    f.job.status = "succeeded";
    f.job.durable!.appliedSequence = f.job.durable!.snapshot!.sequence;
    await flushPromises();
    expect(status()).toContain("Build result saved");
    expect(status()).toContain("Worker acknowledgment pending");
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});

it("requires matching retained-evidence inspection and revision-bound consent before recovery, without creating a fresh run", async () => {
  const f = await fixture();
  const inspect = vi
    .spyOn(f.studio, "inspectDurableBuildEvidence")
    .mockImplementation(async (id, revision) => {
      const current = f.job.durable!;
      const evidence = {
        version: 1 as const,
        ref: structuredClone(toRaw(current.ref)),
        snapshot: { ...structuredClone(toRaw(current.snapshot!)), workspaceCaptured: true },
        observedAt: new Date().toISOString(),
        evidenceHash: "b".repeat(64),
      };
      f.store.state!.runtime.durableBuildInspections = {
        [f.job.id]: {
          ...evidence,
          ideaId: id,
          runId: "original-run",
          runRevision: revision,
        },
      };
      return evidence;
    });
  const recover = vi
    .spyOn(f.studio, "recoverDurableBuild")
    .mockResolvedValue(undefined);
  try {
    f.job.durable!.reconcileError = "Original worker could not be reached";
    await flushPromises();
    const button = (name: string) =>
      f.wrapper.findAll("button").find((item) => item.text() === name)!;
    expect(
      button("Verify and recover interrupted Build").attributes("disabled"),
    ).toBeDefined();
    await button("Inspect retained Build evidence").trigger("click");
    await flushPromises();
    expect(inspect).toHaveBeenCalledWith(f.job.ideaId, 1, 'original-run');
    expect(f.wrapper.text()).toContain('Workspace capture verified: no pending changes.');
    const receipt = f.store.state!.runtime.durableBuildInspections![f.job.id]!;
    delete receipt.snapshot.workspaceCaptured; receipt.evidenceHash = 'c'.repeat(64);
    await flushPromises();
    expect(f.wrapper.text()).toContain('Workspace capture is not available');
    expect(
      button("Verify and recover interrupted Build").attributes("disabled"),
    ).toBeDefined();
    await f.wrapper
      .get('[aria-label="I reviewed the retained Build evidence"]')
      .setValue(true);
    expect(
      button("Verify and recover interrupted Build").attributes("disabled"),
    ).toBeUndefined();
    f.store.state!.ideas[0]!.workflowRun!.revision = 2;
    await flushPromises();
    expect(
      button("Verify and recover interrupted Build").attributes("disabled"),
    ).toBeDefined();
    await button("Inspect retained Build evidence").trigger("click");
    await flushPromises();
    await f.wrapper
      .get('[aria-label="I reviewed the retained Build evidence"]')
      .setValue(true);
    await button("Verify and recover interrupted Build").trigger("click");
    await flushPromises();
    expect(recover).toHaveBeenCalledWith(f.job.ideaId, 2, true, 'original-run');
    expect(f.store.state!.ideas[0]!.workflowRun!.id).toBe("original-run");
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    inspect.mockRestore();
    recover.mockRestore();
    await f.close();
  }
});

it("keeps legacy attempts honest and never offers a fake attachment", async () => {
  const f = await fixture(false);
  try {
    const status = f.wrapper.get('[aria-label="Build execution status"]');
    expect(status.text()).toContain("Legacy foreground attempt");
    expect(status.text()).toContain("180 seconds");
    expect(
      status
        .findAll("button")
        .some((button) => /Attach|Check existing Build/.test(button.text())),
    ).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});

it("uses newer matching runtime snapshots without persisting polls or mixing another worker identity", async () => {
  const f = await fixture();
  try {
    const writes = f.storage.saves;
    const original = structuredClone(toRaw(f.job.durable!.snapshot!));
    const hot = {
      ...original,
      sequence: 4,
      elapsedSeconds: 378000,
      lastContactAt: new Date().toISOString(),
    };
    f.store.state!.runtime.durableBuildSnapshots = { [f.job.id]: hot };
    await flushPromises();
    const status = () =>
      f.wrapper.get('[aria-label="Background Build status"]').text();
    expect(status()).toContain("105h");
    expect(f.job.durable!.snapshot!.elapsedSeconds).toBe(360001);
    f.store.state!.runtime.durableBuildErrors = {
      [f.job.id]: "Original worker unavailable",
    };
    await flushPromises();
    expect(status()).toContain("Build synchronization needs attention");
    f.store.state!.runtime.durableBuildErrors = {};
    f.store.state!.runtime.durableBuildSnapshots = {
      [f.job.id]: {
        ...hot,
        sequence: 999,
        ref: { ...hot.ref, workerId: "foreign-worker" },
        elapsedSeconds: 999 * 3600,
        logs: ["Foreign worker detail"],
      },
    };
    await flushPromises();
    expect(status()).toContain("100h");
    expect(status()).not.toContain("999h");
    expect(status()).not.toContain("Foreign worker detail");
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});

it.each([
  ["mcp", "External MCP execution"],
  ["herdr", "External Herdr session"],
] as const)(
  "keeps %s lifecycle distinct from a native background worker",
  async (provider, heading) => {
    const f = await fixture(false);
    try {
      f.job.provider = provider;
      if (provider === "mcp")
        f.store.state!.ideas[0]!.workflowRun!.external = true;
      await flushPromises();
      const status = f.wrapper.get('[aria-label="Build execution status"]');
      expect(status.text()).toContain(heading);
      expect(status.text()).not.toContain("Legacy foreground attempt");
      expect(
        status
          .findAll("button")
          .some((button) => /Attach|Check existing Build/.test(button.text())),
      ).toBe(false);
      expect(f.runner).not.toHaveBeenCalled();
    } finally {
      await f.close();
    }
  },
);

it("keeps original recovery reachable for a canonically saved result awaiting ACK and blocks a fresh run", async () => {
  const f = await fixture();
  try {
    f.job.status = "succeeded";
    f.job.durable!.snapshot!.phase = "completed";
    f.job.durable!.appliedSequence = f.job.durable!.snapshot!.sequence;
    f.job.durable!.acknowledged = false;
    f.job.durable!.reconcileError =
      "The original daemon stopped before acknowledgment";
    const run = f.store.state!.ideas[0]!.workflowRun!;
    run.state = "finished";
    run.cursor = run.definition.steps.length;
    delete run.activeAttemptId;
    await flushPromises();
    expect(f.wrapper.text()).toContain("Worker acknowledgment pending");
    expect(
      f.wrapper
        .findAll("button")
        .some((button) => button.text() === "Inspect retained Build evidence"),
    ).toBe(true);
    expect(
      f.wrapper
        .findAll("button")
        .some((button) => button.text() === "Start a new workflow run"),
    ).toBe(false);
    f.job.durable!.acknowledged = true;
    await flushPromises();
    expect(
      f.wrapper
        .findAll("button")
        .some((button) => button.text() === "Inspect retained Build evidence"),
    ).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});

it("shows actual queued capacity feedback without calling it a failed provider or offering a nonexistent ref", async () => {
  const f = await fixture();
  try {
    f.job.workflow!.step.execution = { mode: "background" };
    delete f.job.durable;
    f.job.status = "queued";
    f.job.startedAt = new Date(Date.now() - 7260000).toISOString();
    f.job.error = "Waiting for background worker capacity before admission.";
    await flushPromises();
    const status = f.wrapper.get('[aria-label="Background Build status"]');
    expect(status.text()).toContain("Build queued");
    expect(status.text()).toContain("2h");
    expect(status.text()).toContain(
      "Waiting for background worker capacity before admission.",
    );
    expect(status.text()).not.toContain("Build failed");
    expect(
      status
        .findAll("button")
        .some((button) =>
          /Check existing Build|Inspect retained/.test(button.text()),
        ),
    ).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});
