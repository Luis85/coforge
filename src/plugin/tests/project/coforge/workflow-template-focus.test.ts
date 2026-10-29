// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import WorkflowOutputTemplates from "../../../presentation/components/coforge/WorkflowOutputTemplates.vue";
import type {
  WorkflowOutputTemplate,
  WorkflowOutputTemplateActions,
} from "../../../features/coforge/application/workflow-output-templates";
import { workflowUiFixture } from "./workflow-ui-fixture";

const template = (projectId: string): WorkflowOutputTemplate => ({
  id: "report",
  projectId,
  name: "Decision report",
  markdown: "# Decision",
  revision: "revision-one",
});
async function setup(
  remove: WorkflowOutputTemplateActions["remove"] = async () => undefined,
) {
  const fixture = await workflowUiFixture();
  fixture.context.host.outputTemplates = {
    list: async (projectId) => ({
      templates: projectId === "CFP-second" ? [] : [template(projectId)],
      invalid: [],
    }),
    save: async (projectId, input) => ({
      ...input,
      id: input.id ?? "new-report",
      projectId,
      revision: "revision-two",
    }),
    remove,
    open: async () => undefined,
  };
  const wrapper = mount(WorkflowOutputTemplates, {
    attachTo: document.body,
    props: { projectId: fixture.project.id },
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  await flushPromises();
  wrapper.get("details").element.open = true;
  const button = (name: string) => {
    const result = wrapper
      .findAll<HTMLButtonElement>("button")
      .find((item) => item.text().trim() === name);
    if (!result) throw new Error(`Missing ${name}`);
    return result;
  };
  return {
    fixture,
    wrapper,
    button,
    dispose: async () => {
      wrapper.unmount();
      await fixture.dispose();
    },
  };
}

it("hands explicit creation and successful save to the editable field instead of the disabled trigger", async () => {
  const model = await setup();
  try {
    model.button("New template").element.focus();
    await model.button("New template").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      model.wrapper.get('[aria-label="Template name"]').element,
    );
    await model.wrapper
      .get('[aria-label="Template name"]')
      .setValue("New decision report");
    await model.wrapper
      .get('[aria-label="Template Markdown"]')
      .setValue("# Decision\n\n## Evidence");
    model.button("Save template").element.focus();
    await model.wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(document.activeElement).toBe(
      model.wrapper.get('[aria-label="Template Markdown"]').element,
    );
  } finally {
    await model.dispose();
  }
});

it("offers the safe confirmation action, restores the initiator on cancel and moves deletion focus to New template", async () => {
  const remove = vi.fn(async () => undefined);
  const model = await setup(remove);
  try {
    await model.wrapper
      .get('[aria-label="Template library"]')
      .setValue("report");
    model.button("Delete template").element.focus();
    await model.button("Delete template").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(model.button("Keep template").element);
    await model.button("Keep template").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      model.button("Delete template").element,
    );
    expect(remove).not.toHaveBeenCalled();
    await model.button("Delete template").trigger("click");
    await flushPromises();
    model.button("Delete template file").element.focus();
    await model.button("Delete template file").trigger("click");
    await flushPromises();
    expect(remove).toHaveBeenCalledWith(
      model.fixture.project.id,
      "report",
      "revision-one",
    );
    expect(document.activeElement).toBe(model.button("New template").element);
    expect(model.wrapper.get('[role="status"]').text()).toContain(
      "Template deleted.",
    );
  } finally {
    await model.dispose();
  }
});

it("returns discard focus to New template for a new draft and to Markdown for a saved template", async () => {
  const model = await setup();
  try {
    await model.button("New template").trigger("click");
    await flushPromises();
    model.button("Discard template changes").element.focus();
    await model.button("Discard template changes").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(model.button("New template").element);
    expect(model.wrapper.find('[aria-label="Template name"]').exists()).toBe(
      false,
    );
    await model.wrapper
      .get('[aria-label="Template library"]')
      .setValue("report");
    await model.wrapper
      .get('[aria-label="Template Markdown"]')
      .setValue("# Unsaved edits");
    model.button("Discard template changes").element.focus();
    await model.button("Discard template changes").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      model.wrapper.get('[aria-label="Template Markdown"]').element,
    );
    expect(
      model.wrapper.get('[aria-label="Template Markdown"]').element,
    ).toHaveProperty("value", template(model.fixture.project.id).markdown);
    expect(model.fixture.runner).not.toHaveBeenCalled();
  } finally {
    await model.dispose();
  }
});

it("never hands focus to another project when an earlier project deletion completes late", async () => {
  let finish: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const model = await setup(() => pending);
  try {
    await model.wrapper
      .get('[aria-label="Template library"]')
      .setValue("report");
    await model.button("Delete template").trigger("click");
    await flushPromises();
    await model.button("Delete template file").trigger("click");
    await model.wrapper.setProps({ projectId: "CFP-second" });
    await flushPromises();
    await model.button("New template").trigger("click");
    await flushPromises();
    const input = model.wrapper.get<HTMLInputElement>(
      '[aria-label="Template name"]',
    );
    input.element.focus();
    await input.setValue("Keep editing project two");
    finish?.();
    await flushPromises();
    expect(document.activeElement).toBe(input.element);
    expect(input.element).toHaveProperty("value", "Keep editing project two");
    expect(model.wrapper.text()).not.toContain("Template deleted.");
  } finally {
    finish?.();
    await model.dispose();
  }
});

it("announces refresh failures without moving focus from another control", async () => {
  const model = await setup();
  const outside = document.createElement("button");
  document.body.append(outside);
  try {
    model.fixture.context.host.outputTemplates!.list = async () => {
      throw new Error(
        "Template catalogue is unavailable. Try Refresh templates again.",
      );
    };
    outside.focus();
    await model.button("Refresh templates").trigger("click");
    await flushPromises();
    expect(model.wrapper.get('[role="alert"]').text()).toContain(
      "Try Refresh templates again.",
    );
    expect(document.activeElement).toBe(outside);
  } finally {
    outside.remove();
    await model.dispose();
  }
});
