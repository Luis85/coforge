// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import StudioSidebar from "../../../presentation/components/coforge/StudioSidebar.vue";
import StudioTopbar from "../../../presentation/components/coforge/StudioTopbar.vue";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("leads with Build & Improve and keeps configuration beside its owning journey", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioSidebar, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    const groups = wrapper.findAll('.cf-nav-group[role="group"]');
    expect(groups.map((group) => group.attributes("aria-label"))).toEqual([
      "Build & Improve navigation",
      "Stream navigation",
      "Community navigation",
      "Insights navigation",
    ]);
    expect(groups[0]?.text()).toContain("Project settings");
    expect(groups[0]?.findAll('.cf-nav-item').map(button => button.text().trim()).slice(0, 2)).toEqual([expect.stringContaining('Idea board'), 'The Council']);
    expect(groups[2]?.text()).toContain("Community settings");
    expect(wrapper.find(".cf-sidebar-bottom").text()).not.toContain(
      "Project settings",
    );
    expect(wrapper.findAll('button[aria-current="page"]')).toHaveLength(1);
    const saveCount = fixture.storage.saves;
    await wrapper.get('button[title="Community settings"]').trigger("click");
    expect(fixture.store.view).toBe("community-settings");
    expect(wrapper.findAll('button[aria-current="page"]')).toHaveLength(1);
    expect(fixture.storage.saves).toBe(saveCount);
    await wrapper.get('button[title="Manage projects"]').trigger("click");
    expect(fixture.store.view).toBe("projects");
    expect(wrapper.get('button[aria-current="page"]').classes()).toContain(
      "cf-project-switcher",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("shows workspace scope for shared tools and project identity only for project work", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StudioTopbar, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    expect(wrapper.get(".cf-breadcrumb").text()).toContain("Channel workspace");
    expect(wrapper.find(".cf-project-id-copy").exists()).toBe(false);
    fixture.store.navigate("council");
    await flushPromises();
    expect(wrapper.get(".cf-breadcrumb").text()).toContain("Vault workspace");
    expect(wrapper.find(".cf-provider-pill").exists()).toBe(false);
    fixture.store.navigate("board");
    await flushPromises();
    expect(wrapper.get(".cf-breadcrumb").text()).toContain(fixture.project.id);
    expect(
      wrapper.get(".cf-project-id-copy").attributes("aria-label"),
    ).toContain(fixture.project.id);
    expect(wrapper.find(".cf-provider-pill").exists()).toBe(true);
    fixture.store.navigate("finance");
    await flushPromises();
    expect(wrapper.get(".cf-breadcrumb").text()).toContain("Channel workspace");
    expect(wrapper.find(".cf-project-id-copy").exists()).toBe(false);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("keeps the dirty workflow and current destination when another journey is selected", async () => {
  const fixture = await workflowUiFixture();
  fixture.store.view = "workflow-settings";
  fixture.store.dirtyWorkflow = true;
  const wrapper = mount(StudioSidebar, {
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await wrapper.get('button[title="Stream studio"]').trigger("click");
    expect(fixture.store.view).toBe("workflow-settings");
    expect(wrapper.get('button[aria-current="page"]').text()).toBe(
      "Agent workflow",
    );
    expect(fixture.store.dirtyWorkflow).toBe(true);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
