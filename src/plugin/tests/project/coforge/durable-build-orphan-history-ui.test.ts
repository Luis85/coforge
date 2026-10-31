// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import WorkflowView from "../../../presentation/components/coforge/WorkflowView.vue";
import { workflowAttemptRows } from "../../../presentation/composables/coforge/configured-workflow-history";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import type { AgentJob } from "../../../features/coforge/domain/types";
import { workflowUiFixture } from "./workflow-ui-fixture";

async function fixture() {
  const f = await workflowUiFixture();
  const definition = defaultWorkflowDefinition(f.project.settings);
  const step = definition.steps.find((item) => item.id === "implement");
  if (!step || step.kind !== "ai") throw new Error("Missing Build");
  step.provider = "claude";
  step.model = "captured-sonnet";
  step.execution = { mode: "background" };
  const job: AgentJob = {
    id: "retained-orphan",
    projectId: f.project.id,
    ideaId: "CF-999",
    stage: "implement",
    provider: "claude",
    model: "captured-sonnet",
    status: "running",
    startedAt: new Date().toISOString(),
    logs: ["Retained original job"],
    workflow: {
      runId: "missing-run",
      attemptId: "original-attempt",
      definitionRevision: "saved-definition",
      proposalRevision: "original-input",
      step,
      inputArtifacts: [],
    },
    durable: {
      intent: "start",
      policy: { mode: "background", maxTurns: 50, maxBudgetUsd: 20 },
      ref: {
        version: 1,
        executionId: "original-execution",
        workerId: "original-worker",
        epoch: 1,
        inputHash: "a".repeat(64),
      },
    },
  };
  return { ...f, job };
}

it("retains actual captured job facts when request/run metadata is missing without inventing a result", async () => {
  const f = await fixture();
  try {
    const rows = workflowAttemptRows([], [f.job]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ideaId: "CF-999",
      status: "running",
      canCancel: true,
      canOpenIdea: false,
    });
    expect(rows[0]!.providerLabel).toContain("captured-sonnet");
    expect(rows[0]!.log).toContain("metadata is unavailable");
    expect(rows[0]!.log).toContain("Retained original job");
    expect(rows[0]!.status).not.toBe("succeeded");
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    await f.dispose();
  }
});

it("keeps job-ID cancellation reachable in Step attempts while the missing request link stays disabled", async () => {
  const f = await fixture();
  f.store.state!.ideas = [];
  f.store.state!.jobs = [f.job];
  f.store.openWorkflowTool("runs");
  const cancel = vi.spyOn(f.studio, "cancel").mockResolvedValue(undefined);
  const wrapper = mount(WorkflowView, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const row = wrapper.get(".cf-workflow-history-row");
    expect(row.text()).toContain("CF-999");
    expect(row.text()).toContain("metadata is unavailable");
    expect(
      row
        .findAll("button")
        .find((button) => button.text().trim() === "Open idea")!
        .attributes("disabled"),
    ).toBeDefined();
    await row
      .findAll("button")
      .find((button) => button.text().trim() === "Cancel run")!
      .trigger("click");
    await flushPromises();
    expect(cancel).toHaveBeenCalledWith("retained-orphan");
    expect(f.store.selected).toBeNull();
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    cancel.mockRestore();
    wrapper.unmount();
    await f.dispose();
  }
});
