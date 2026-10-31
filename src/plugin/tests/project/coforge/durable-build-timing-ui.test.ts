// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import WorkflowView from "../../../presentation/components/coforge/WorkflowView.vue";
import WorkflowEditorView from "../../../presentation/components/coforge/WorkflowEditorView.vue";
import WorkflowCapturedConfiguration from "../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue";
import { useWorkflowEditorStore } from "../../../presentation/stores/coforge-workflow-editor";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("makes Build execution findable from Timing without replacing or saving the shared draft", async () => {
  const f = await workflowUiFixture();
  f.store.openWorkflowTool("limits");
  const wrapper = mount(WorkflowView, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const editor = useWorkflowEditorStore(f.pinia);
    const session = editor.session;
    const writes = f.storage.saves;
    const overview = wrapper.get('[aria-label="Build execution policies"]');
    expect(overview.text()).toContain("Foreground");
    await overview
      .findAll("button")
      .find((button) => button.text() === "Configure Build execution")!
      .trigger("click");
    expect(f.store.workflowTool).toBe("settings");
    expect(editor.selectedId).toBe("implement");
    expect(editor.session).toBe(session);
    expect(
      wrapper.get('[aria-label="Build execution policy"]').element.tagName,
    ).toBe("SELECT");
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("takes an invalid background deadline to its exact field and keeps the draft unsaved", async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    attachTo: document.body,
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    const editor = useWorkflowEditorStore(f.pinia);
    editor.selectedId = "implement";
    const step = editor.draft.steps.find((item) => item.id === "implement");
    if (!step || step.kind !== "ai") throw new Error("Missing Build");
    step.provider = "claude";
    step.execution = { mode: "background", maxRuntimeSeconds: 0 };
    await flushPromises();
    const repair = wrapper
      .get('[aria-label="Workflow validation"]')
      .findAll("button")
      .find((button) => button.text().includes("Execution deadline"));
    expect(repair).toBeDefined();
    await repair!.trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('[data-workflow-field="execution.maxRuntimeSeconds"]')
        .element,
    );
    expect(f.studio.state().settings.workflow).toBeUndefined();
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("reads captured Build execution limits without substituting current project settings", async () => {
  const f = await workflowUiFixture();
  const definition = defaultWorkflowDefinition(f.project.settings);
  const step = definition.steps.find((item) => item.id === "implement");
  if (!step || step.kind !== "ai") throw new Error("Missing Build");
  step.provider = "claude";
  step.execution = {
    mode: "background",
    maxRuntimeSeconds: 432000,
    idleWarningSeconds: 0,
    maxTurns: 300,
    maxBudgetUsd: 35,
  };
  const at = new Date().toISOString();
  const run: WorkflowRun = {
    id: "captured-policy",
    ideaId: "CF-101",
    projectId: f.project.id,
    definition,
    proposalRevision: "original",
    revision: 1,
    cursor: 0,
    state: "ready",
    attempts: [],
    artifacts: [],
    createdAt: at,
    updatedAt: at,
  };
  const wrapper = mount(WorkflowCapturedConfiguration, {
    props: { run },
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    const policy = wrapper.get('[aria-label="Captured execution policies"]');
    expect(policy.text()).toContain("120h");
    expect(policy.text()).toContain("300");
    expect(policy.text()).toContain("USD35");
    const before = policy.text();
    f.store.activeProject!.settings.timeoutSeconds = 15;
    await flushPromises();
    expect(policy.text()).toBe(before);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});
