// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import WorkflowEditorView from "../../../presentation/components/coforge/WorkflowEditorView.vue";
import { useWorkflowEditorStore } from "../../../presentation/stores/coforge-workflow-editor";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("selects an invalid step and opens and focuses its hidden model field without saving or dispatching", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    attachTo: document.body,
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    await wrapper.get('[aria-label="AI provider"]').setValue("claude");
    await wrapper.get('[aria-label="AI model"]').setValue('__custom');
    await wrapper.get('[aria-label="Custom model ID"]').setValue("--invalid");
    await wrapper
      .findAll(".cf-workflow-step-select")
      .find((button) => button.text().includes("Plan"))!
      .trigger("click");
    const summary = wrapper.get('[aria-label="Workflow validation"]');
    const fix = summary
      .findAll("button")
      .find(
        (button) =>
          button.text().includes("Screen") &&
          button.text().includes("AI model"),
      );
    expect(fix).toBeDefined();
    await fix!.trigger("click");
    await flushPromises();
    const input = wrapper.get('[aria-label="Custom model ID"]');
    expect(input.element).toHaveProperty("value", "--invalid");
    expect(input.element.closest("details")).toHaveProperty("open", true);
    expect(document.activeElement).toBe(input.element);
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("repairs an empty checklist at its add action and focuses the exact invalid later item", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    attachTo: document.body,
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Add checklist")!
      .trigger("click");
    await wrapper
      .get('[aria-label="Remove checklist item 1"]')
      .trigger("click");
    const fixEmpty = wrapper
      .get('[aria-label="Workflow validation"]')
      .findAll("button")
      .find((button) => button.text().includes("Checklist items"));
    await fixEmpty!.trigger("click");
    await flushPromises();
    const add = wrapper
      .findAll("button")
      .find((button) => button.text() === "Add checklist item");
    expect(document.activeElement).toBe(add!.element);
    const editor = useWorkflowEditorStore(fixture.pinia);
    const checklist = editor.draft.steps.find(step => step.id === editor.selectedId);
    if (!checklist || checklist.kind !== "checklist")
      throw new Error("Expected a checklist");
    checklist.items = [
      { id: "first", label: "Already valid", required: true },
      { id: "second", label: "", required: true },
    ];
    await flushPromises();
    const fixItem = wrapper
      .get('[aria-label="Workflow validation"]')
      .findAll("button")
      .find((button) => button.text().includes("Checklist items"));
    await fixItem!.trigger("click");
    await flushPromises();
    const invalid = wrapper.get('[data-workflow-field="items[1].label"]');
    expect(document.activeElement).toBe(invalid.element);
    expect(invalid.element).toHaveProperty("value", "");
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("takes a dependency problem to previous results and a workflow-name problem to its exact field", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    attachTo: document.body,
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const editor = useWorkflowEditorStore(fixture.pinia);
    const first = editor.draft.steps[0];
    if (!first || first.kind !== "ai")
      throw new Error("Expected an AI first step");
    first.inputs = ["plan"];
    await flushPromises();
    const fixInputs = wrapper
      .get('[aria-label="Workflow validation"]')
      .findAll("button")
      .find((button) => button.text().includes("Previous results"));
    await fixInputs!.trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[data-workflow-field="inputs"]').element.closest("details"),
    ).toHaveProperty("open", true);
    expect(document.activeElement).toBe(
      wrapper.get('[data-workflow-field="inputs"]').element,
    );
    first.inputs = [];
    editor.draft.name = '';
    await flushPromises();
    const fixName = wrapper
      .get('[aria-label="Workflow validation"]')
      .findAll("button")
      .find((button) => button.text().includes("Workflow name"));
    await fixName!.trigger("click");
    await flushPromises();
    const name = wrapper.get('[data-workflow-field="name"]');
    expect(fixture.store.workflowTool).toBe("settings");
    expect(name.isVisible()).toBe(true);
    expect(document.activeElement).toBe(name.element);
    expect(fixture.runner).not.toHaveBeenCalled();
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
