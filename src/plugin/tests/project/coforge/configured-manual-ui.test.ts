// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it, vi } from "vitest";
import ConfiguredManualStep from "../../../presentation/components/coforge/ConfiguredManualStep.vue";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
const complete = vi.fn(
  async (
    _id: string,
    _revision: number,
    _checked: string[],
    _note: string,
  ) => {},
);
vi.mock("../../../presentation/context/coforge-context", () => ({
  useCoforge: () => ({ studio: { completeWorkflowManual: complete } }),
}));
it("requires current required checklist decisions and resets them when the run revision changes", async () => {
  complete.mockClear();
  const step = {
    id: "human",
    name: "Review report",
    instructions: "Read **the report**.",
    kind: "checklist" as const,
    items: [
      { id: "required", label: "Inspect the report", required: true },
      { id: "optional", label: "Share follow-up", required: false },
    ],
  };
  const run: WorkflowRun = {
    id: "run",
    ideaId: "CF-123",
    projectId: "CFP-001",
    definition: {
      ...defaultWorkflowDefinition(defaultSettings()),
      steps: [step],
    },
    proposalRevision: "proposal",
    revision: 1,
    cursor: 0,
    state: "waiting-human",
    attempts: [],
    artifacts: [],
    createdAt: "",
    updatedAt: "",
  };
  const wrapper = mount(ConfiguredManualStep, {
    props: { ideaId: "CF-123", run, step },
    global: { plugins: [createPinia()] },
  });
  try {
    expect(wrapper.get("strong").text()).toBe("the report");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await wrapper.get("form").trigger("submit");
    expect(complete).not.toHaveBeenCalled();
    await wrapper.get('input[value="required"]').setValue(true);
    await wrapper.setProps({ run: { ...run, revision: 2 } });
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await wrapper.get('input[value="required"]').setValue(true);
    await wrapper.get("textarea").setValue("Reviewed this request revision.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(complete).toHaveBeenCalledExactlyOnceWith(
      "CF-123",
      2,
      ["required"],
      "Reviewed this request revision.",
    );
  } finally {
    wrapper.unmount();
  }
});
