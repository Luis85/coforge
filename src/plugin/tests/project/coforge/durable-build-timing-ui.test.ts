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

it("keeps old timing deep links read-only without replacing or saving the shared task draft", async () => {
  const f = await workflowUiFixture(); f.store.openWorkflowTool('limits');
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); const session = editor.session; const writes = f.storage.saves;
    const before = JSON.stringify(editor.draft);
    const behavior = wrapper.get('[aria-label="Managed agent behavior"]');
    expect(behavior.text()).toContain('completion'); expect(behavior.find('input').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Build execution policy"]').exists()).toBe(false);
    f.store.openWorkflowTool('settings'); await flushPromises();
    expect(editor.session).toBe(session); expect(JSON.stringify(editor.draft)).toBe(before);
    expect(f.storage.saves).toBe(writes); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it("keeps model validation actionable when obsolete execution inputs have been removed", async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], directives: { 'cf-icon': () => {} } } });
  try {
    await wrapper.get('[aria-label="AI provider"]').setValue('claude');
    await wrapper.get('[aria-label="AI model"]').setValue('__custom');
    await wrapper.get('[aria-label="Custom model ID"]').setValue('--invalid');
    const repair = wrapper.get('[aria-label="Workflow validation"]').findAll('button').find(button => button.text().includes('AI model'));
    expect(repair).toBeDefined(); await repair!.trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Custom model ID"]').element);
    expect(wrapper.find('[data-workflow-field="execution.maxRuntimeSeconds"]').exists()).toBe(false);
    expect(f.studio.state().settings.workflow).toBeUndefined(); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
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
