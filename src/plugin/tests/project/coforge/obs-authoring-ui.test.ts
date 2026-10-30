// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ObsShowPlan from "../../../presentation/components/coforge/ObsShowPlan.vue";
import { ObsShowWorkflow } from "../../../features/coforge/application/obs-show-workflow";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { useObsShowUi } from "../../../presentation/stores/obs-show-ui";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("authors and saves a reusable show plan without running actions, preserving its private draft", async () => {
  const fixture = await workflowUiFixture();
  const execute = vi.fn(async () => {});
  const show = new ObsShowWorkflow(fixture.studio.store, {
    execute,
    live: () => false,
  });
  await show.start();
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      obsShow: show,
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => false,
      saveExport: async () => "",
      publishBoard: async () => ({ folder: "", changed: false }),
      installPagesWorkflow: async () => ({
        folder: "",
        workflow: "",
        created: false,
      }),
    },
  };
  const wrapper = mount(ObsShowPlan, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  const button = (name: string) =>
    wrapper.findAll("button").find((item) => item.text() === name)!;
  try {
    await flushPromises();
    await button("Create show plan").trigger("click");
    const ui = useObsShowUi(fixture.pinia);
    expect(ui.draft?.segments.map((segment) => segment.name)).toEqual([
      "Starting soon",
      "Development",
      "The Council",
      "Playtest",
      "BRB",
      "Ending",
    ]);
    const actionSelect = wrapper
      .findAll("select")
      .find((select) => select.find('option[value="marker"]').exists())!;
    await actionSelect.setValue("marker");
    await button("Add action to cue").trigger("click");
    await button("Save show plan").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Show plan saved");
    expect(
      fixture.studio.state().obsShow?.plans[0]?.segments[0]?.steps,
    ).toEqual([{ kind: "marker", label: "Starting soon" }]);
    expect(ui.dirty).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(button("Run selected cue").attributes("disabled")).toBeDefined();
    const input = wrapper
      .findAll("input")
      .find((item) => item.element.value === "My stream")!;
    await input.setValue("Private rehearsal");
    expect(ui.dirty).toBe(true);
    expect(ui.draft?.name).toBe("Private rehearsal");
    expect(fixture.studio.state().obsShow?.plans[0]?.name).toBe("My stream");
  } finally {
    wrapper.unmount();
    show.dispose();
    await fixture.dispose();
  }
});
