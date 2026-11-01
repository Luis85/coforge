// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import WorkflowEditorView from "../../../presentation/components/coforge/WorkflowEditorView.vue";
import { useWorkflowEditorStore } from "../../../presentation/stores/coforge-workflow-editor";
import { workflowUiFixture } from "./workflow-ui-fixture";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { workflowProposalRevision } from "../../../features/coforge/domain/configured-workflow-run";

it("presents managed Build sessions without editing earlier captured execution or exposing a background switch", async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({
    title: "Existing captured Build",
    description: "Keep its foreground policy.",
    category: "Gameplay",
    username: "Owner",
  });
  await f.studio.store.transaction((state) => {
    const idea = state.ideas[0]!;
    const at = new Date().toISOString();
    idea.workflowRun = {
      id: "legacy-run",
      ideaId: idea.id,
      projectId: f.project.id,
      definition: defaultWorkflowDefinition(f.project.settings),
      proposalRevision: workflowProposalRevision(idea),
      revision: 1,
      cursor: 4,
      state: "attention",
      attempts: [],
      artifacts: [],
      createdAt: at,
      updatedAt: at,
    };
  });
  const captured = JSON.stringify(f.studio.state().ideas[0]!.workflowRun);
  const wrapper = mount(WorkflowEditorView, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    const editor = useWorkflowEditorStore(f.pinia);
    editor.selectedId = "implement";
    const build = editor.draft.steps.find((step) => step.id === "implement");
    if (!build || build.kind !== "ai") throw new Error("Expected Build");
    build.provider = "claude";
    await flushPromises();
    const writes = f.storage.saves;
    const saved = JSON.stringify(f.studio.state().settings.workflow);
    const limits = { ...editor.draft.limits };
    expect(wrapper.find('[aria-label="Build execution policy"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="Agent session behavior"]').text()).toContain('Quiet periods do not end the task');
    expect(build.execution).toBeUndefined();
    expect(editor.draft.limits).toEqual(limits);
    expect(f.storage.saves).toBe(writes);
    expect(JSON.stringify(f.studio.state().settings.workflow)).toBe(saved);
    expect(JSON.stringify(f.studio.state().ideas[0]!.workflowRun)).toBe(
      captured,
    );
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("preserves saved legacy overrides without presenting them as controls for new managed tasks", async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    const editor = useWorkflowEditorStore(f.pinia);
    editor.selectedId = "implement";
    const build = editor.draft.steps.find((step) => step.id === "implement");
    if (!build || build.kind !== "ai") throw new Error("Expected Build");
    build.provider = "codex";
    build.model = "gpt-5.4";
    await flushPromises();
    const original = { mode: 'background' as const, maxRuntimeSeconds: 432000, idleWarningSeconds: 0, maxTurns: 200, maxBudgetUsd: 35 };
    build.execution = { ...original }; await flushPromises();
    for (const name of ['Set an elapsed deadline', 'Warn about inactivity', 'Override Build tool or turn cap', 'Override Build USD cap']) {
      expect(wrapper.find(`[aria-label="${name}"]`).exists()).toBe(false);
    }
    await wrapper.get('[aria-label="Step instructions"]').setValue('Keep the requested implementation focused.');
    expect(build.execution).toEqual(original);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("explains missing worker readiness before a new background Build while still allowing configuration", async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    const editor = useWorkflowEditorStore(f.pinia);
    editor.selectedId = "implement";
    const build = editor.draft.steps.find((step) => step.id === "implement");
    if (!build || build.kind !== "ai") throw new Error("Expected Build");
    build.provider = "claude";
    build.execution = { mode: "background" };
    f.store.activeProject!.allowImplementation = true;
    f.store.state!.runtime.cliAvailable = true;
    f.store.state!.runtime.durableBuild = {
      ready: false,
      message: "Check the configured background worker in Runtime.",
    };
    await flushPromises();
    expect(wrapper.get(".cf-workflow-readiness").text()).toContain(
      "background worker",
    );
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Save workflow")!
        .attributes("disabled"),
    ).toBeUndefined();
    f.store.state!.runtime.durableBuild = {
      ready: true,
      message: "Worker verified",
    };
    await flushPromises();
    expect(wrapper.find(".cf-workflow-readiness").exists()).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});
