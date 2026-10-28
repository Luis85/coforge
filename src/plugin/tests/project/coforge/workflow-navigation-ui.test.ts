// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { expect, it } from "vitest";
import { useStudioActions } from "../../../presentation/composables/coforge/use-studio-actions";
import { workflowUiFixture } from "./workflow-ui-fixture";
it("blocks every project-switching action while a workflow draft is unsaved", async () => {
  const fixture = await workflowUiFixture();
  const binding: { actions?: ReturnType<typeof useStudioActions> } = {};
  const Probe = defineComponent({
    setup() {
      binding.actions = useStudioActions();
      return () => h("div");
    },
  });
  const wrapper = mount(Probe, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    const actions = binding.actions;
    if (!actions) throw new Error("Actions missing");
    fixture.store.dirtyWorkflow = true;
    await nextTick();
    const writes = fixture.storage.saves;
    expect(
      await actions.createProject({
        projectName: "Wrong target",
        projectBrief: "Must not replace the editor project.",
        projectPath: "/synthetic/other",
      }),
    ).toBe(false);
    expect(await actions.selectProject(fixture.project.id)).toBe(false);
    expect(fixture.storage.saves).toBe(writes);
    expect(fixture.studio.state().projects).toHaveLength(1);
    expect(fixture.studio.state().activeProjectId).toBe(fixture.project.id);
    expect(fixture.store.toasts.at(-1)?.message).toContain("workflow settings");
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
