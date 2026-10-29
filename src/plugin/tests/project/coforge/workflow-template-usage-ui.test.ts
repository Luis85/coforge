// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import WorkflowTemplateUsage from "../../../presentation/components/coforge/WorkflowTemplateUsage.vue";
import { createOutputTemplatesPreview } from "../../../../../harness/prototype/output-templates-preview";
import type { WorkflowOutputTemplateUsage } from "../../../features/coforge/application/workflow-output-template-usage";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("shows saved dependency names and incomplete-read recovery without dispatching or bleeding late responses across projects", async () => {
  const fixture = await workflowUiFixture();
  let release: (value: WorkflowOutputTemplateUsage) => void = () => {};
  const held = new Promise<WorkflowOutputTemplateUsage>((resolve) => {
    release = resolve;
  });
  const references = vi.fn(async (id: string) =>
    id === fixture.project.id
      ? held
      : { references: [], unavailable: "Proposal references need repair." },
  );
  fixture.context.host.outputTemplates = {
    ...createOutputTemplatesPreview(() => undefined),
    references,
  };
  const wrapper = mount(WorkflowTemplateUsage, {
    props: { projectId: fixture.project.id, templateId: "answer" },
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain("Checking saved workflow steps");
    await wrapper.setProps({ projectId: "CFP-999999" });
    await flushPromises();
    expect(references).toHaveBeenLastCalledWith("CFP-999999", "answer");
    expect(wrapper.text()).toContain("Proposal references need repair.");
    release({
      references: [
        {
          workflow: "request",
          workflowName: "Original project",
          stepId: "report",
          stepName: "Write report",
        },
      ],
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain("Original project");
    await wrapper.setProps({ projectId: fixture.project.id });
    await flushPromises();
    expect(wrapper.text()).toContain("Original project");
    expect(wrapper.text()).toContain("Write report");
    expect(wrapper.text()).toContain("Deletion keeps existing run snapshots");
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
