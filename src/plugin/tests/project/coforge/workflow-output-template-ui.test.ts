// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { nextTick, watchEffect } from "vue";
import { useOutputTemplateStore } from "../../../presentation/stores/coforge-output-templates";
import WorkflowOutputTemplates from "../../../presentation/components/coforge/WorkflowOutputTemplates.vue";
import type {
  WorkflowOutputTemplate,
  WorkflowOutputTemplateActions,
} from "../../../features/coforge/application/workflow-output-templates";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("explicitly creates and edits project Markdown templates, preserves conflicted drafts, and confirms the exact deletion", async () => {
  const fixture = await workflowUiFixture();
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
  let templates: WorkflowOutputTemplate[] = [];
  let fail = false;
  const actions: WorkflowOutputTemplateActions = {
    list: vi.fn(async () => ({
      templates: structuredClone(templates),
      invalid: [],
    })),
    save: vi.fn(async (projectId, input, expectedRevision) => {
      if (fail)
        throw new Error("Template changed externally. Refresh before saving.");
      if (input.id) expect(expectedRevision).toBe("revision-one");
      const template = {
        ...input,
        id: input.id ?? "report",
        projectId,
        revision: input.id ? "revision-two" : "revision-one",
      };
      templates = [template];
      return template;
    }),
    remove: vi.fn(async () => {
      templates = [];
    }),
    open: vi.fn(async () => undefined),
  };
  fixture.context.host.outputTemplates = actions;
  const wrapper = mount(WorkflowOutputTemplates, {
    props: { projectId: fixture.project.id },
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  const button = (label: string) => {
    const found = wrapper
      .findAll("button")
      .find((item) => item.text().trim() === label);
    if (!found) throw new Error(`Missing ${label}`);
    return found;
  };
  try {
    await flushPromises();
    await button("New template").trigger("click");
    await wrapper.get('[aria-label="Template name"]').setValue("Review report");
    await wrapper
      .get('[aria-label="Template Markdown"]')
      .setValue("# Summary\n\n## Risks\n");
    expect(actions.save).not.toHaveBeenCalled();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(actions.save).toHaveBeenCalledWith(
      fixture.project.id,
      { name: "Review report", markdown: "# Summary\n\n## Risks\n" },
      undefined,
    );
    expect(wrapper.text()).toContain("Template saved");
    expect(wrapper.emitted("changed")).toHaveLength(1);
    await wrapper
      .get('[aria-label="Template Markdown"]')
      .setValue("# Revised summary\n");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(actions.save).toHaveBeenLastCalledWith(
      fixture.project.id,
      { id: "report", name: "Review report", markdown: "# Revised summary\n" },
      "revision-one",
    );
    await wrapper
      .get('[aria-label="Template name"]')
      .setValue("Keep this edit");
    fail = true;
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "changed externally",
    );
    expect(wrapper.get('[aria-label="Template name"]').element).toHaveProperty(
      "value",
      "Keep this edit",
    );
    await button("Copy template draft Markdown").trigger("click");
    await flushPromises();
    expect(clipboard).toHaveBeenCalledWith("# Revised summary\n");
    templates = templates.map((template) => ({
      ...template,
      revision: "revision-three",
      markdown: "# Latest saved summary\n",
    }));
    await button("Refresh templates").trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="Template name"]').element).toHaveProperty(
      "value",
      "Keep this edit",
    );
    expect(
      wrapper.get('[aria-label="Template conflict recovery"]').text(),
    ).toContain("Copy your draft Markdown first");
    expect(
      wrapper.get('[aria-label="Latest saved template Markdown"]').text(),
    ).toContain("# Latest saved summary");
    await button("Discard template changes").trigger("click");
    await flushPromises();
    await button("Open Markdown note").trigger("click");
    await flushPromises();
    expect(actions.open).toHaveBeenCalledWith(fixture.project.id, "report");
    await button("Delete template").trigger("click");
    expect(actions.remove).not.toHaveBeenCalled();
    expect(
      wrapper.get('[aria-label="Confirm template deletion"]').text(),
    ).toContain("Review report");
    await button("Delete template file").trigger("click");
    await flushPromises();
    expect(actions.remove).toHaveBeenCalledWith(
      fixture.project.id,
      "report",
      "revision-three",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
    expect(fixture.studio.state().settings.workflow).toBeUndefined();
  } finally {
    clipboard.mockRestore();
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("keeps a project template draft and ignores a late catalogue when another project is selected", async () => {
  const fixture = await workflowUiFixture();
  const template = (projectId: string): WorkflowOutputTemplate => ({
    id: "report",
    projectId,
    name: `${projectId} report`,
    markdown: "# Summary",
    revision: "revision-one",
  });
  let finishFirst:
    | ((value: { templates: WorkflowOutputTemplate[]; invalid: [] }) => void)
    | undefined;
  const first = new Promise<{
    templates: WorkflowOutputTemplate[];
    invalid: [];
  }>((resolve) => {
    finishFirst = resolve;
  });
  const save = vi.fn(async () => template("CFP-first"));
  fixture.context.host.outputTemplates = {
    list: async (id) =>
      id === "CFP-first" ? first : { templates: [template(id)], invalid: [] },
    save,
    remove: async () => undefined,
    open: async () => undefined,
  };
  const wrapper = mount(WorkflowOutputTemplates, {
    props: { projectId: "CFP-first" },
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await wrapper.setProps({ projectId: "CFP-second" });
    await flushPromises();
    await wrapper.get('[aria-label="Template library"]').setValue("report");
    await wrapper
      .get('[aria-label="Template name"]')
      .setValue("Unsaved second-project outline");
    finishFirst?.({ templates: [template("CFP-first")], invalid: [] });
    await flushPromises();
    expect(wrapper.get('[aria-label="Template name"]').element).toHaveProperty(
      "value",
      "Unsaved second-project outline",
    );
    expect(wrapper.get('[aria-label="Template library"]').text()).not.toContain(
      "CFP-first report",
    );
    await wrapper.setProps({ projectId: "CFP-first" });
    await flushPromises();
    expect(wrapper.get('[aria-label="Template library"]').text()).toContain(
      "CFP-first report",
    );
    await wrapper.setProps({ projectId: "CFP-second" });
    await flushPromises();
    expect(wrapper.get('[aria-label="Template name"]').element).toHaveProperty(
      "value",
      "Unsaved second-project outline",
    );
    expect(save).not.toHaveBeenCalled();
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("renders a newly visited project's asynchronously completed catalogue without another user action", async () => {
  const fixture = await workflowUiFixture();
  let finish:
    | ((value: { templates: WorkflowOutputTemplate[]; invalid: [] }) => void)
    | undefined;
  const pending = new Promise<{
    templates: WorkflowOutputTemplate[];
    invalid: [];
  }>((resolve) => {
    finish = resolve;
  });
  fixture.context.host.outputTemplates = {
    list: () => pending,
    save: async () => {
      throw new Error("Unexpected save");
    },
    remove: async () => undefined,
    open: async () => undefined,
  };
  const wrapper = mount(WorkflowOutputTemplates, {
    props: { projectId: "CFP-newly-visited" },
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain("Loading templates");
    finish?.({
      templates: [
        {
          id: "report",
          projectId: "CFP-newly-visited",
          name: "Asynchronous report",
          markdown: "# Summary",
          revision: "revision-one",
        },
      ],
      invalid: [],
    });
    await flushPromises();
    expect(wrapper.get('[aria-label="Template library"]').text()).toContain(
      "Asynchronous report",
    );
    expect(wrapper.text()).not.toContain("Loading templates");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("keeps the first project editor observable when an async response updates its notice", async () => {
  const fixture = await workflowUiFixture();
  const store = useOutputTemplateStore(fixture.pinia);
  let visibleNotice = "";
  const stop = watchEffect(() => {
    visibleNotice = store.editor("CFP-first-editor").notice;
  });
  try {
    await Promise.resolve();
    store.editor("CFP-first-editor").notice = "The catalogue response arrived.";
    await nextTick();
    expect(visibleNotice).toBe("The catalogue response arrived.");
  } finally {
    stop();
    await fixture.dispose();
  }
});
