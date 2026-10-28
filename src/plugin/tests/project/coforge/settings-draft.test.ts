// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { expect, it } from "vitest";
import {
  useSettings,
  type SettingsModel,
} from "../../../presentation/composables/coforge/use-settings";
import { workflowUiFixture } from "./workflow-ui-fixture";
it("keeps project drafts on external changes and stale saves while workflow configuration stays outside the project form", async () => {
  const fixture = await workflowUiFixture();
  const binding: { model?: SettingsModel } = {};
  const Probe = defineComponent({
    setup() {
      binding.model = useSettings();
      return () => h("div");
    },
  });
  const wrapper = mount(Probe, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    const model = binding.model;
    if (!model) throw new Error("Project form missing");
    expect(model.draft).not.toHaveProperty("stageAgents");
    expect(model.draft).not.toHaveProperty("model");
    model.draft.agentPrompt = "Keep this local project convention.";
    await nextTick();
    await fixture.studio.updateProject(
      { projectBrief: "A newly edited canonical brief from another window." },
      fixture.project.id,
    );
    await flushPromises();
    const before = fixture.storage.saves;
    model.submit(new Event("submit"));
    await flushPromises();
    expect(fixture.storage.saves).toBe(before);
    expect(model.draft.agentPrompt).toBe("Keep this local project convention.");
    expect(model.error).toContain("changed outside");
    model.discard();
    await flushPromises();
    expect(model.draft.projectBrief).toBe(
      "A newly edited canonical brief from another window.",
    );
    expect(model.dirty).toBe(false);
    model.draft.agentPrompt = "Saved general project prompt.";
    await nextTick();
    model.submit(new Event("submit"));
    await flushPromises();
    expect(fixture.studio.state().settings.agentPrompt).toBe(
      "Saved general project prompt.",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
