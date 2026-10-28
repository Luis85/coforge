// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { expect, it, vi } from "vitest";
import {
  useWorkflowEditor,
  type WorkflowEditorModel,
} from "../../../presentation/composables/coforge/use-workflow-editor";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { workflowUiFixture } from "./workflow-ui-fixture";
it("previews imports without writes, replaces only the local draft, and saves one explicit per-project definition", async () => {
  const fixture = await workflowUiFixture();
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({
    setup() {
      binding.model = useWorkflowEditor();
      return () => h("div");
    },
  });
  const wrapper = mount(Probe, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    const model = binding.model;
    if (!model) throw new Error("Editor missing");
    const baseline = fixture.storage.saves;
    const imported = {
      ...workflowDefinition(fixture.studio.state().settings),
      name: "Review only",
      steps: [
        {
          id: "approve",
          kind: "approval",
          name: "Review report",
          instructions: "**Review** the proposal.",
        },
      ],
    };
    model.transfer.openImport();
    model.transfer.text = JSON.stringify(imported);
    model.transfer.inspect();
    expect(model.transfer.preview?.name).toBe("Review only");
    expect(model.draft.name).not.toBe("Review only");
    expect(fixture.storage.saves).toBe(baseline);
    model.transfer.text = "{invalid";
    expect(model.transfer.preview).toBeNull();
    model.transfer.replace();
    expect(model.draft.name).not.toBe("Review only");
    model.transfer.text = JSON.stringify(imported);
    model.transfer.inspect();
    model.transfer.replace();
    await nextTick();
    expect(model.draft.name).toBe("Review only");
    expect(model.dirty).toBe(true);
    expect(fixture.store.dirtyWorkflow).toBe(true);
    expect(fixture.storage.saves).toBe(baseline);
    model.transfer.text = "{invalid";
    model.transfer.inspect();
    expect(model.draft.name).toBe("Review only");
    expect(model.transfer.preview).toBeNull();
    model.save();
    await flushPromises();
    expect(fixture.studio.state().settings.workflow?.name).toBe("Review only");
    expect(model.dirty).toBe(false);
    model.transfer.openExport();
    expect(model.transfer.exportJson).toContain("**Review**");
    expect(model.transfer.exportJson).not.toContain("/synthetic/workflow");
    expect(model.transfer.exportJson).not.toContain("projectBrief");
    model.transfer.saveExport();
    await flushPromises();
    expect(fixture.saveExport).toHaveBeenCalledOnce();
    expect(model.transfer.exportPath).toBe("private-workflow.json");
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
it("keeps a dirty workflow on an external edit and refuses stale saves until discard loads the new source", async () => {
  const fixture = await workflowUiFixture();
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({
    setup() {
      binding.model = useWorkflowEditor();
      return () => h("div");
    },
  });
  const wrapper = mount(Probe, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    const model = binding.model;
    if (!model) throw new Error("Editor missing");
    model.draft.name = "Local workflow";
    await nextTick();
    const source = workflowDefinition(fixture.studio.state().settings);
    await fixture.studio.saveWorkflow(
      fixture.project.id,
      { ...source, name: "External workflow" },
      JSON.stringify(source),
    );
    await flushPromises();
    expect(model.stale).toBe(true);
    expect(model.draft.name).toBe("Local workflow");
    const before = fixture.storage.saves;
    model.save();
    await flushPromises();
    expect(fixture.storage.saves).toBe(before);
    expect(model.draft.name).toBe("Local workflow");
    model.discard();
    await nextTick();
    expect(model.draft.name).toBe("External workflow");
    expect(model.dirty).toBe(false);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
async function editorFixture() {
  const fixture = await workflowUiFixture();
  const binding: { model?: WorkflowEditorModel } = {};
  const Probe = defineComponent({
    setup() {
      binding.model = useWorkflowEditor();
      return () => h("div");
    },
  });
  const wrapper = mount(Probe, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  const model = binding.model;
  if (!model) throw new Error("Editor missing");
  return {
    ...fixture,
    model,
    dispose: async () => {
      wrapper.unmount();
      await fixture.dispose();
    },
  };
}
it("does not save an old project draft into a newly selected project and retains an invalid explicit model", async () => {
  const fixture = await editorFixture();
  try {
    const step = fixture.model.draft.steps[0];
    if (step?.kind !== "ai") throw new Error("AI step missing");
    step.provider = "claude";
    step.model = "--invalid-model";
    await nextTick();
    const beforeInvalid = fixture.storage.saves;
    fixture.model.save();
    await flushPromises();
    expect(fixture.storage.saves).toBe(beforeInvalid);
    expect(step.model).toBe("--invalid-model");
    expect(fixture.model.error).toBeTruthy();
    const other = await fixture.studio.createProject({
      projectName: "Other project",
      projectBrief: "An independent project workflow for the external switch.",
      projectPath: "/synthetic/other",
    });
    await flushPromises();
    const beforeWrongProject = fixture.storage.saves;
    fixture.model.save();
    await flushPromises();
    expect(fixture.storage.saves).toBe(beforeWrongProject);
    expect(
      fixture.model.draft.steps[0]?.kind === "ai" &&
        fixture.model.draft.steps[0].model,
    ).toBe("--invalid-model");
    expect(fixture.model.stale).toBe(true);
    expect(fixture.studio.state().activeProjectId).toBe(other.id);
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
    expect(fixture.runner).not.toHaveBeenCalled();
    fixture.model.discard();
    await nextTick();
    expect(fixture.model.project?.id).toBe(other.id);
    expect(fixture.model.dirty).toBe(false);
  } finally {
    await fixture.dispose();
  }
});
it("keeps the workflow draft when a save fails after another source update", async () => {
  const fixture = await editorFixture();
  try {
    fixture.model.draft.name = "Keep my process";
    await nextTick();
    const save = fixture.studio.saveWorkflow.bind(fixture.studio);
    vi.spyOn(fixture.studio, "saveWorkflow").mockImplementationOnce(
      async (id) => {
        const current = workflowDefinition(fixture.studio.state().settings);
        await save(
          id,
          { ...current, name: "Changed during failed save" },
          JSON.stringify(current),
        );
        await nextTick();
        throw new Error("Synthetic save failure after source update.");
      },
    );
    fixture.model.save();
    await flushPromises();
    expect(fixture.model.draft.name).toBe("Keep my process");
    expect(fixture.model.dirty).toBe(true);
    expect(fixture.model.error).toContain("Synthetic save failure");
    expect(fixture.studio.state().settings.workflow?.name).toBe(
      "Changed during failed save",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
    const writes = fixture.storage.saves;
    fixture.model.save();
    await flushPromises();
    expect(fixture.storage.saves).toBe(writes);
    fixture.model.discard();
    await nextTick();
    expect(fixture.model.draft.name).toBe("Changed during failed save");
    expect(fixture.model.dirty).toBe(false);
  } finally {
    await fixture.dispose();
  }
});
it("preserves the reviewed draft when its successful save is followed immediately by a newer external definition", async () => {
  const fixture = await editorFixture();
  try {
    fixture.model.draft.name = "My saved workflow";
    await nextTick();
    const save = fixture.studio.saveWorkflow.bind(fixture.studio);
    vi.spyOn(fixture.studio, "saveWorkflow").mockImplementationOnce(
      async (id, input, expected) => {
        const written = await save(id, input, expected);
        const current = workflowDefinition(written.settings);
        await save(
          id,
          { ...current, name: "Newer external workflow" },
          JSON.stringify(current),
        );
        await nextTick();
        return written;
      },
    );
    fixture.model.save();
    await flushPromises();
    expect(fixture.model.draft.name).toBe("My saved workflow");
    expect(fixture.model.dirty).toBe(true);
    expect(fixture.model.stale).toBe(true);
    expect(fixture.model.error).toContain(
      "saved, but the source changed again",
    );
    expect(fixture.studio.state().settings.workflow?.name).toBe(
      "Newer external workflow",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
    fixture.model.discard();
    await nextTick();
    expect(fixture.model.draft.name).toBe("Newer external workflow");
    expect(fixture.model.dirty).toBe(false);
  } finally {
    await fixture.dispose();
  }
});
