// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import WorkflowEditorView from "../../../presentation/components/coforge/WorkflowEditorView.vue";
import IdeaWorkflowTab from "../../../presentation/components/coforge/IdeaWorkflowTab.vue";
import { useWorkflowEditorStore } from "../../../presentation/stores/coforge-workflow-editor";
import { useOutputTemplateStore } from "../../../presentation/stores/coforge-output-templates";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("keeps selected agent, access and automation visible and previews the selected template rather than the library draft", async () => {
  const fixture = await workflowUiFixture();
  fixture.context.host.outputTemplates = {
    list: async (projectId) => ({
      templates: [
        {
          id: "report",
          projectId,
          name: "Answer report",
          markdown: "# Required summary\n\n## Next steps",
          revision: "revision-one",
        },
      ],
      invalid: [],
    }),
    save: async () => {
      throw new Error("No template save requested");
    },
    remove: async () => undefined,
    open: async () => undefined,
  };
  const wrapper = mount(WorkflowEditorView, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const current = wrapper.get('[aria-label="Current step configuration"]');
    expect(current.text()).toContain("Simulation");
    expect(current.text()).toContain("No project access");
    expect(current.text()).toContain("Automatic when resumed");
    await wrapper
      .get('[aria-label="Answer / output template"]')
      .setValue("report");
    const library = useOutputTemplateStore(fixture.pinia).editor(
      fixture.project.id,
    );
    library.selectedId = "different-template";
    library.draft = {
      id: "different-template",
      name: "Another template draft",
      markdown: "# Unrelated draft",
    };
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Selected template Markdown source"]').text(),
    ).toContain("# Required summary");
    expect(
      wrapper.get('[aria-label="Selected template Markdown source"]').text(),
    ).not.toContain("# Unrelated draft");
    const editor = useWorkflowEditorStore(fixture.pinia);
    editor.draft.steps.push({
      id: "nudge",
      name: "Ask a specialist",
      kind: "nudge",
      instructions: "Review the request",
      teamId: "team-one",
      agentId: "specialist",
    });
    await flushPromises();
    expect(wrapper.get(".cf-workflow-policy").text()).toContain(
      "1 agent nudge",
    );
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("shows a persisted admission hold without inventing a run and offers an explicit retry", async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.createIdea({
    title: "Restore a missing template",
    description: "Admission stopped before dispatch.",
    category: "Gameplay",
    username: "Owner",
  });
  await fixture.studio.store.transaction((state) => {
    state.ideas[0]!.lastError =
      "An output template is missing. Refresh templates and clear or replace its selection.";
  });
  const idea = fixture.studio.state().ideas[0]!;
  fixture.store.select(idea.id, 'workflow');
  const wrapper = mount(IdeaWorkflowTab, {
    props: { idea },
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const next = wrapper.get('[aria-label="Next workflow action"]');
    expect(next.text()).toContain("Workflow start needs attention");
    expect(next.text()).toContain("An output template is missing");
    const retry = wrapper.findAll("button").find((button) => button.text() === "Retry starting workflow");
    expect(retry).toBeDefined();
    expect(retry!.attributes("disabled")).toBeUndefined();
    expect(fixture.studio.state().ideas[0]?.workflowRun).toBeUndefined();
    expect(fixture.studio.state().jobs).toEqual([]);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
