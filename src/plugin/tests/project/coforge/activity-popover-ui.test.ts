// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import ActivityPopover from "../../../presentation/components/coforge/ActivityPopover.vue";
import { workflowUiFixture } from "./workflow-ui-fixture";

afterEach(() => document.body.replaceChildren());

it("renders static activity as readable rows, preserves full timestamps and opens the request owning project only after draft guards pass", async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({
    title: "Scoped activity request",
    description: "Inspect the actual owning request.",
    category: "Gameplay",
    username: "Owner",
  });
  const idea = f.studio.state().ideas[0]!;
  const other = await f.studio.createProject({
    projectName: "Other active project",
    projectBrief: "Keep its configuration independent.",
    projectPath: "/synthetic/other-activity",
  });
  const at = new Date(Date.now() - 3 * 86400000).toISOString();
  await f.studio.store.transaction((state) => {
    state.events = [
      {
        id: "static-event",
        text: "Project configuration observed.",
        type: "system",
        createdAt: at,
      },
      {
        id: "request-event",
        ideaId: idea.id,
        text: "Inspect this request event.",
        type: "idea",
        createdAt: at,
      },
    ];
  });
  f.store.activityOpen = true;
  const wrapper = mount(ActivityPopover, {
    attachTo: document.body,
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    expect(
      wrapper
        .findAll("button.cf-activity-item")
        .filter((item) => item.attributes("disabled") !== undefined),
    ).toHaveLength(0);
    expect(
      wrapper
        .findAll(".cf-activity-item")
        .some(
          (item) =>
            item.element.tagName !== "BUTTON" &&
            item.text().includes("Project configuration observed."),
        ),
    ).toBe(true);
    const time = wrapper.get("time");
    expect(time.attributes("datetime")).toBe(at);
    expect(time.attributes("title")).toContain("2026");
    expect(time.text()).toContain("3d ago");
    const event = wrapper
      .findAll("button.cf-activity-item")
      .find((item) => item.text().includes("Inspect this request event."))!;
    f.store.view = "settings";
    f.store.dirtySettings = true;
    await event.trigger("click");
    await flushPromises();
    expect(f.store.activityOpen).toBe(true);
    expect(f.store.selected).toBeNull();
    expect(f.store.activeProject?.id).toBe(other.id);
    f.store.dirtySettings = false;
    await event.trigger("click");
    await flushPromises();
    expect(f.store.activeProject?.id).toBe(f.project.id);
    expect(f.store.selected).toBe(idea.id);
    expect(f.store.activityOpen).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("closes with Escape and restores focus to the activity opener", async () => {
  const f = await workflowUiFixture();
  f.store.activityOpen = true;
  const opener = document.createElement("button");
  opener.textContent = "Recent activity";
  document.body.append(opener);
  opener.focus();
  const wrapper = mount(ActivityPopover, {
    attachTo: document.body,
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(f.store.activityOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});
