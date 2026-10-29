// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import WorkflowCapturedConfiguration from "../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { ai, definition } from "./configured-workflow-fixture";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("reads the captured template revision and Markdown after live deletion without consulting the template service", async () => {
  const fixture = await workflowUiFixture();
  const list = vi.fn(async () => ({ templates: [], invalid: [] }));
  fixture.context.host.outputTemplates = {
    list,
    save: async () => {
      throw new Error("Unexpected write");
    },
    remove: async () => undefined,
    open: async () => undefined,
  };
  const run: WorkflowRun = {
    id: "run",
    ideaId: "idea",
    projectId: fixture.project.id,
    definition: definition([
      { ...ai("analysis"), outputTemplateId: "template" },
    ]),
    outputTemplates: [
      {
        id: "template",
        projectId: fixture.project.id,
        name: "Captured answer",
        markdown:
          "# Original answer\n\nOriginal evidence.\n\n<!-- exact captured hint -->\n<section>Literal markup</section>\n",
        revision: "captured-template-revision",
      },
    ],
    proposalRevision: "proposal",
    revision: 0,
    cursor: 0,
    state: "ready",
    attempts: [],
    artifacts: [],
    createdAt: "2026-10-29T12:00:00.000Z",
    updatedAt: "2026-10-29T12:00:00.000Z",
  };
  const wrapper = mount(WorkflowCapturedConfiguration, {
    props: { run },
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    expect(wrapper.text()).toContain("custom-v1");
    expect(wrapper.text()).toContain("Captured answer");
    expect(wrapper.text()).toContain("captured-template-revision");
    expect(wrapper.text()).toContain("analysis");
    expect(wrapper.get("h1").text()).toBe("Original answer");
    expect(wrapper.text()).toContain("Original evidence.");
    expect(
      wrapper.get('[aria-label="Captured Markdown source for Captured answer"]')
        .element.textContent,
    ).toBe(run.outputTemplates?.[0]?.markdown);
    expect(list).not.toHaveBeenCalled();
    expect(fixture.runner).not.toHaveBeenCalled();
    await wrapper.setProps({
      run: {
        ...run,
        definition: definition([ai("legacy")]),
        outputTemplates: undefined,
      },
    });
    expect(wrapper.text()).toContain("No output templates were captured");
    expect(wrapper.text()).not.toContain("Captured answer");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
