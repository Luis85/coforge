// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import WorkflowEditorView from "../../../presentation/components/coforge/WorkflowEditorView.vue";
import { useWorkflowEditorStore } from "../../../presentation/stores/coforge-workflow-editor";
import { workflowUiFixture } from "./workflow-ui-fixture";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { workflowProposalRevision } from "../../../features/coforge/domain/configured-workflow-run";

it("opts future native Builds into background execution without rewriting captured runs or raising resource bounds", async () => {
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
    const policy = wrapper.get('[aria-label="Build execution policy"]');
    expect(policy.element).toHaveProperty("value", "foreground");
    await policy.setValue("background");
    expect(build.execution).toEqual({
      mode: "background",
      idleWarningSeconds: 1800,
    });
    expect(editor.draft.limits).toEqual(limits);
    expect(wrapper.text()).toContain(
      "Existing attempts keep their captured policy",
    );
    expect(wrapper.text()).toContain("No elapsed deadline");
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

it("configures an optional 100-hour deadline, advisory idle warning and explicit resource overrides only in the draft", async () => {
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
    await wrapper
      .get('[aria-label="Build execution policy"]')
      .setValue("background");
    await wrapper.get('[aria-label="Set an elapsed deadline"]').setValue(true);
    await wrapper.get('[aria-label="Build deadline hours"]').setValue("120");
    await wrapper.get('[aria-label="Warn about inactivity"]').setValue(false);
    await wrapper
      .get('[aria-label="Override Build tool or turn cap"]')
      .setValue(true);
    await wrapper.get('[aria-label="Build tool or turn cap"]').setValue("200");
    await wrapper.get('[aria-label="Override Build USD cap"]').setValue(true);
    await wrapper.get('[aria-label="Build USD cap"]').setValue("35");
    expect(build.execution).toMatchObject({
      mode: "background",
      maxRuntimeSeconds: 432000,
      idleWarningSeconds: 0,
      maxTurns: 200,
      maxBudgetUsd: 35,
    });
    expect(wrapper.text()).toContain(
      "Codex does not enforce the USD spending cap",
    );
    await wrapper.get('[aria-label="Set an elapsed deadline"]').setValue(false);
    expect(build.execution?.maxRuntimeSeconds).toBeUndefined();
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
