// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { expect, it, vi } from "vitest";
import { useObsShow } from "../../../presentation/composables/coforge/use-obs-show";
import { ObsShowWorkflow } from "../../../features/coforge/application/obs-show-workflow";
import type { ObsShowPlan } from "../../../features/coforge/domain/obs-show";
import { workflowUiFixture } from "./workflow-ui-fixture";
import ObsShowPlanView from "../../../presentation/components/coforge/ObsShowPlan.vue";

vi.mock("../../../presentation/composables/coforge/use-obs-production", () => ({
  useObsProduction: () => ({ canChange: true, scenes: [], ui: {} }),
}));

const plan = (id: string): ObsShowPlan => ({
  id,
  name: `Show ${id}`,
  segments: [
    {
      id: "opening",
      name: "Opening",
      note: "",
      durationSeconds: 60,
      steps: [{ kind: "marker", label: `Start ${id}` }],
    },
  ],
  bindings: [],
});

async function fixture() {
  const value = await workflowUiFixture();
  const show = new ObsShowWorkflow(value.studio.store, {
    execute: async () => {},
    live: () => false,
  });
  await show.start();
  await show.savePlan(plan("a"));
  await show.savePlan(plan("b"));
  value.context.host.obsShow = show;
  const model: { current?: ReturnType<typeof useObsShow> } = {};
  const wrapper = mount(
    defineComponent({
      setup() {
        model.current = useObsShow();
        return () => null;
      },
    }),
    { global: { plugins: [value.pinia, value.provider] } },
  );
  if (!model.current) throw new Error("Show model was not mounted.");
  return {
    ...value,
    show,
    model: model.current,
    dispose: async () => {
      wrapper.unmount();
      show.dispose();
      await value.dispose();
    },
  };
}

it("runs and removes the loaded plan when the load picker points at another plan", async () => {
  const value = await fixture();
  try {
    const { model, show } = value;
    model.ui.selectedPlan = "a";
    model.load();
    model.ui.selectedPlan = "b";
    expect(model.saved?.id).toBe("a");
    await model.runCue();
    expect(show.snapshot().markers.map((marker) => marker.label)).toEqual([
      "Start a",
    ]);
    model.ui.deleteConfirmation = true;
    await model.deletePlan();
    expect(show.snapshot().plans.map((item) => item.id)).toEqual(["b"]);
  } finally {
    await value.dispose();
  }
});

it("keeps later edits dirty while a captured save is pending and prevents replacing that draft", async () => {
  const value = await fixture();
  try {
    const { model } = value;
    model.ui.selectedPlan = "a";
    model.load();
    let finish: (() => void) | undefined;
    const original = value.show.savePlan.bind(value.show);
    vi.spyOn(value.show, "savePlan").mockImplementation(async (input) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return original(input);
    });
    model.ui.draft!.name = "Captured name";
    model.markDirty();
    const saving = model.save();
    model.ui.draft!.name = "Later edit";
    model.markDirty();
    model.discard();
    expect(model.ui.draft?.name).toBe("Later edit");
    finish?.();
    await saving;
    expect(model.ui.dirty).toBe(true);
    expect(model.ui.draft?.name).toBe("Later edit");
    expect(value.show.snapshot().plans[0]?.name).toBe("Captured name");
  } finally {
    await value.dispose();
  }
});

it("rejects cue execution with unsaved changes even when invoked outside a disabled button", async () => {
  const value = await fixture();
  try {
    const { model } = value;
    model.ui.selectedPlan = "a";
    model.load();
    model.ui.draft!.segments[0]!.note = "Private draft";
    model.markDirty();
    await model.runCue();
    expect(value.show.snapshot().run).toBeUndefined();
    expect(model.ui.error).toContain("Save or discard");
  } finally {
    await value.dispose();
  }
});

it("preserves failed-save edits and describes untimed segments without inventing a full show duration", async () => {
  const value = await fixture();
  try {
    const { model } = value;
    model.ui.selectedPlan = "a";
    model.load();
    expect(model.cuePosition).toBe(1);
    expect(model.canMoveCueEarlier).toBe(false);
    expect(model.totalDurationLabel).toBe("1m planned");
    model.addCue();
    expect(model.canMoveCueEarlier).toBe(true);
    expect(model.canMoveCueLater).toBe(false);
    expect(model.totalDurationLabel).toBe("1m planned · 1 untimed segment");
    expect(model.segmentDuration(0)).toBe("No countdown");
    vi.spyOn(value.show, "savePlan").mockRejectedValue(
      new Error("Storage unavailable"),
    );
    await model.save();
    expect(model.ui.dirty).toBe(true);
    expect(model.ui.draft?.segments).toHaveLength(2);
    expect(model.ui.error).toBe("Storage unavailable");
    expect(value.show.snapshot().plans[0]?.segments).toHaveLength(1);
  } finally {
    await value.dispose();
  }
});

it("requires reloading when the saved cue changes after its actions were reviewed", async () => {
  const value = await fixture();
  try {
    const { model, show } = value;
    model.ui.selectedPlan = "a";
    model.load();
    const replacement = plan("a");
    replacement.segments[0]!.steps = [
      { kind: "marker", label: "Changed externally" },
    ];
    await show.savePlan(replacement);
    await model.runCue();
    expect(show.snapshot().run).toBeUndefined();
    expect(model.ui.error).toContain("Reload");
    model.load();
    await model.runCue();
    expect(show.snapshot().markers.map((marker) => marker.label)).toEqual([
      "Changed externally",
    ]);
  } finally {
    await value.dispose();
  }
});

it("reconciles normalized saved definitions without falsely treating them as stale", async () => {
  const value = await fixture();
  try {
    const { model } = value;
    model.ui.selectedPlan = "a";
    model.load();
    model.ui.draft!.name = "  Trimmed show  ";
    model.markDirty();
    await model.save();
    expect(model.ui.draft?.name).toBe("Trimmed show");
    expect(model.canRunCue).toBe(true);
  } finally {
    await value.dispose();
  }
});

it("shows an invalid-duration state for empty, negative, fractional and oversized number input", async () => {
  const value = await fixture();
  const wrapper = mount(ObsShowPlanView, {
    global: { plugins: [value.pinia, value.provider] },
  });
  try {
    const { model } = value;
    model.ui.selectedPlan = "a";
    model.load();
    model.addCue();
    const middle = model.ui.selectedCue;
    model.addCue();
    model.cue!.durationSeconds = 60;
    model.ui.selectedCue = middle;
    await wrapper.vm.$nextTick();
    const input = wrapper.get('input[type="number"]');
    for (const invalid of ["", "-1", "1.5", "14401"]) {
      await input.setValue(invalid);
      expect(model.totalDurationLabel).toBe("Review segment durations");
      expect(wrapper.get('[aria-label="Show rundown"]').text()).toContain(
        "Invalid duration",
      );
    }
    await input.setValue("90");
    expect(model.totalDurationLabel).toBe("3m 30s planned");
  } finally {
    wrapper.unmount();
    await value.dispose();
  }
});
