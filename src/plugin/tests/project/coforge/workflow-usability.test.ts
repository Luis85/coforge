// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import WorkflowEditorView from "../../../presentation/components/coforge/WorkflowEditorView.vue";
import WorkflowView from "../../../presentation/components/coforge/WorkflowView.vue";
import { workflowUiFixture } from "./workflow-ui-fixture";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";

it("leads AI step editing with its purpose and keeps agent and automation controls in named disclosures", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const fields = wrapper.get(".cf-workflow-ai-fields");
    const labels = fields.findAll("label").map((label) => label.text());
    expect(labels[0]).toContain("Step instructions");
    await fields
      .findAll("button")
      .find((button) => button.text() === "Manage templates")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get(".cf-workflow-template-library").element).toHaveProperty(
      "open",
      true,
    );
    const agent = fields
      .findAll("details")
      .find(
        (details) =>
          details.get("summary").text() === "Agent and project access",
      );
    const automation = fields
      .findAll("details")
      .find(
        (details) =>
          details.get("summary").text() === "Automation and previous results",
      );
    expect(agent?.find('[aria-label="AI provider"]').exists()).toBe(true);
    expect(
      automation
        ?.find('[aria-label="Minimum votes before this step"]')
        .exists(),
    ).toBe(true);
    const chooser = wrapper
      .findAll("details")
      .find((details) => details.get("summary").text() === "Add a step");
    expect(chooser).toBeDefined();
    await chooser!
      .findAll("button")
      .find((button) => button.text() === "Add approval")!
      .trigger("click");
    expect(wrapper.get(".cf-workflow-step-editor").text()).toContain(
      "Manual approval",
    );
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("distinguishes a completed checkpoint workflow from code accepted through final review", async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.createIdea({
    title: "Review the result",
    description: "Keep completion distinct from accepted code.",
    category: "Gameplay",
    username: "Owner",
  });
  const definition = workflowDefinition(fixture.studio.state().settings);
  await fixture.studio.saveWorkflow(
    fixture.project.id,
    {
      ...definition,
      steps: [
        {
          id: "review",
          name: "Review",
          kind: "approval",
          instructions: "Inspect the result.",
        },
      ],
    },
    JSON.stringify(definition),
  );
  const idea = fixture.studio.state().ideas[0]!;
  const run = await fixture.studio.startWorkflow(idea.id);
  await fixture.studio.completeWorkflowManual(idea.id, run.revision, []);
  const wrapper = mount(WorkflowView, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain(
      "Completing the workflow alone does not accept code",
    );
    await fixture.studio.store.transaction((state) => {
      const request = state.ideas.find((item) => item.id === idea.id)!;
      request.status = "shipped";
    });
    await flushPromises();
    expect(wrapper.get('[aria-label="Next workflow action"]').text()).toContain(
      "Code changes accepted",
    );
    expect(wrapper.text()).toContain(
      "Code changes were accepted through final review",
    );
    expect(wrapper.text()).not.toContain(
      "Completing the workflow alone does not accept code",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("explains the next workflow action and marks the current step without starting execution", async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.createIdea({
    title: "A clear next action",
    description: "Understand which step runs next.",
    category: "Gameplay",
    username: "Owner",
  });
  const wrapper = mount(WorkflowView, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.get('[aria-label="Next workflow action"]').text()).toContain(
      "Screen",
    );
    expect(wrapper.get('[aria-label="Next workflow action"]').text()).toContain(
      "Start",
    );
    expect(
      wrapper
        .get('[aria-label="Captured workflow steps"]')
        .find('[aria-current="step"]')
        .text(),
    ).toContain("Screen");
    expect(fixture.studio.state().jobs).toEqual([]);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
