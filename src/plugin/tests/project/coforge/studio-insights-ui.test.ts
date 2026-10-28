// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it } from "vitest";
import PopulationView from "../../../presentation/components/coforge/PopulationView.vue";
import OperationsView from "../../../presentation/components/coforge/OperationsView.vue";
import { recordOperation } from "../../../features/coforge/application/population";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("turns the observed registration gap into a reversible viewer filter", async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.ingest({ username: "Registered", source: "twitch", userId: "41", text: "!register" });
  await fixture.studio.ingest({ username: "Observer", source: "twitch", userId: "42", text: "Hello" });
  const wrapper = mount(PopulationView, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await flushPromises();
    const overview = wrapper.get('[aria-label="Viewer participation overview"]');
    expect(overview.text()).toContain("2 observed");
    expect(overview.text()).toContain("1 registered");
    await overview.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".cf-player-name").map(row => row.text())).toEqual([expect.stringContaining("Observer")]);
    expect(fixture.runner).not.toHaveBeenCalled();
    await wrapper.get('[aria-label="Clear viewer filters"]').trigger("click");
    expect(wrapper.findAll(".cf-player-name")).toHaveLength(2);
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("labels retained uncertainty as historical evidence and filters it without implying recovery", async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.transaction(state => {
    recordOperation(state, "reply-uncertain", "uncertain");
    recordOperation(state, "reply-confirmed", "committed");
  });
  const wrapper = mount(OperationsView, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await flushPromises();
    const overview = wrapper.get('[aria-label="Retained operational evidence"]');
    expect(overview.text()).toContain("1 unconfirmed event");
    expect(overview.text()).toContain("historical");
    await overview.get("button").trigger("click");
    await flushPromises();
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text()).toContain("reply uncertain");
    expect(fixture.runner).not.toHaveBeenCalled();
    expect(fixture.studio.state().population?.operations.filter(row => row.effect === "uncertain")).toHaveLength(1);
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
