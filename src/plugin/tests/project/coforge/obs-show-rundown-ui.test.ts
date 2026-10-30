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

it("shows the ordered rundown and selected presenter notes without executing a cue", async () => {
  const fixture = await workflowUiFixture();
  const execute = vi.fn(async () => {});
  const show = new ObsShowWorkflow(fixture.studio.store, {
    execute,
    live: () => false,
  });
  await show.start();
  await show.savePlan({
    id: "friday",
    name: "Friday show",
    bindings: [],
    segments: [
      {
        id: "intro",
        name: "Welcome",
        note: "Introduce today's game",
        durationSeconds: 90,
        steps: [{ kind: "marker", label: "Welcome" }],
      },
      {
        id: "build",
        name: "Build together",
        note: "Read the winning request",
        durationSeconds: 300,
        steps: [],
      },
    ],
  });
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
  try {
    const ui = useObsShowUi(fixture.pinia);
    ui.selectedPlan = "friday";
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Load show plan")!
      .trigger("click");
    const rundown = wrapper.get('ol[aria-label="Show rundown"]');
    expect(rundown.findAll("li")).toHaveLength(2);
    expect(rundown.text()).toContain("1m 30s");
    expect(rundown.text()).toContain("1 action");
    expect(wrapper.text()).toContain("6m 30s planned");
    expect(rundown.findAll("button")[0]!.attributes("aria-current")).toBe(
      "step",
    );
    expect(
      rundown.findAll("button")[0]!.attributes("aria-label"),
    ).toBeUndefined();
    expect(rundown.findAll("button")[0]!.text()).toContain("1m 30s");
    await rundown.findAll("button")[1]!.trigger("click");
    expect(ui.selectedCue).toBe("build");
    expect(ui.dirty).toBe(false);
    const runner = wrapper.get(
      'section[aria-label="Run the selected show cue"]',
    );
    expect(runner.text()).toContain("Build together");
    expect(runner.text()).toContain("Read the winning request");
    expect(
      runner
        .findAll("button")
        .find((button) => button.text() === "Run selected cue")!
        .attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Move segment later")!
        .attributes("disabled"),
    ).toBeDefined();
    expect(execute).not.toHaveBeenCalled();
    ui.deleteConfirmation = true;
    await wrapper
      .findAll("input")
      .find((input) => input.element.value === "Friday show")!
      .setValue("Friday draft");
    const removal = wrapper
      .findAll("details")
      .find(
        (details) => details.get("summary").text() === "Remove saved show plan",
      )!;
    expect(
      removal.get('input[type="checkbox"]').attributes("disabled"),
    ).toBeDefined();
    expect(removal.get("button").attributes("disabled")).toBeDefined();
    expect(removal.text()).toContain(
      "Save or discard your changes before removing this plan.",
    );
  } finally {
    wrapper.unmount();
    show.dispose();
    await fixture.dispose();
  }
});
