// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ObsShowPlan from "../../../presentation/components/coforge/ObsShowPlan.vue";
import ObsStudioSetup from "../../../presentation/components/coforge/ObsStudioSetup.vue";
import { ObsShowWorkflow } from "../../../features/coforge/application/obs-show-workflow";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import type { ObsSetupActions } from "../../../features/coforge/application/obs-setup-workflow";
import { useObsSetupUi } from "../../../presentation/stores/obs-setup-ui";
import { useObsShowUi } from "../../../presentation/stores/obs-show-ui";
import { workflowUiFixture } from "./workflow-ui-fixture";
import { obsSetupInputCheck } from "../../../features/coforge/domain/obs-setup-check";
import type { ObsProductionActions } from "../../../features/coforge/application/obs-production-workflow";
import type { ObsProductionSnapshot } from "../../../features/coforge/domain/obs-production";

it("previews visible camera capture and optional title slates, then directs device testing after reviewed creation", async () => {
  const fixture = await workflowUiFixture();
  const at = new Date().toISOString();
  const value: ObsProductionSnapshot = {
    context: { epoch: 1, collection: 0, revision: 0 },
    observedAt: at,
    broadcast: {
      epoch: 1,
      revision: 1,
      scenes: [{ id: "dev", name: "CoForge · Development" }],
      programSceneId: "dev",
      active: false,
      reconnecting: false,
      transitioning: false,
      timecode: "",
      observedAt: at,
    },
    available: ["input-create"],
    inputKinds: ["dshow_input", "text_gdiplus_v2", "text_gdiplus_v3"],
    filterKinds: [],
    inputs: [
      {
        id: "camera",
        name: "Camera",
        kind: "dshow_input",
        settings: {},
        audio: {
          muted: null,
          volumeDb: null,
          monitor: null,
          syncOffset: null,
          tracks: null,
          peakDb: null,
          meterObservedAt: null,
        },
      },
    ],
    studioMode: false,
    transitions: [],
    transition: null,
    recording: null,
    replayBuffer: null,
    virtualCamera: null,
    video: null,
    recordDirectory: null,
    lastRecording: null,
    lastReplay: null,
  };
  const production: ObsProductionActions = {
    inspect: async () => structuredClone(value),
    execute: async () => structuredClone(value),
    acknowledgeOutputRestart: async () => structuredClone(value),
    frame: async (sceneId) => ({
      sceneId,
      dataUrl: "data:image/png;base64,AAAA",
      observedAt: at,
      kind: "screenshot",
    }),
    properties: async () => [],
    filters: async () => [],
    saveOutputSecret: async () => {},
    transform: async () => ({
      positionX: 0,
      positionY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
      boundsType: "OBS_BOUNDS_NONE",
      boundsWidth: 0,
      boundsHeight: 0,
      alignment: 5,
    }),
  };
  const preview = vi.fn(async (input: unknown) => ({
    id: "reviewed",
    context: value.context,
    input: obsSetupInputCheck(input),
    scenes: [{ role: "development" as const, name: "CoForge · Development" }],
    steps: ["Create reviewed studio"],
  }));
  const apply = vi.fn(async () => ({
    state: {
      id: "setup",
      startedAt: at,
      status: "confirmed" as const,
      completed: ["scene"],
      total: 1,
      scenes: { development: "dev" },
    },
    liveSceneId: "dev",
    breakSceneId: "brb",
  }));
  await fixture.studio.store.updateRuntime({
    obs: {
      connection: "connected",
      snapshot: value.broadcast,
      busy: false,
      prepared: false,
      onBreak: false,
      uncertain: false,
    },
  });
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      obsProduction: production,
      obsSetup: {
        preview,
        apply,
        snapshot: () => undefined,
        recover: async () => undefined,
      },
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
  const wrapper = mount(ObsStudioSetup, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  const button = (name: string) =>
    wrapper.findAll("button").find((item) => item.text() === name)!;
  try {
    await button("Read OBS capabilities").trigger("click");
    await flushPromises();
    const ui = useObsSetupUi(fixture.pinia);
    ui.sourceName = "Camera";
    ui.sourceKind = "dshow_input";
    await flushPromises();
    await button("Add source to studio draft").trigger("click");
    await button("Preview studio creation").trigger("click");
    await flushPromises();
    expect(
      ui.preview?.input.sources.find((source) => source.name === "Camera")
        ?.enabled,
    ).toBe(true);
    expect(
      ui.preview?.input.sources
        .filter((source) => source.inputKind === "text_gdiplus_v3")
        .map((source) => source.roles[0]),
    ).toEqual(["starting", "brb", "ending"]);
    expect(apply).not.toHaveBeenCalled();
    ui.confirmed = true;
    await flushPromises();
    await button("Create reviewed studio").trigger("click");
    await flushPromises();
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      previewId: "reviewed",
      confirmed: true,
    });
    await button("Choose devices and test captures").trigger("click");
    expect(fixture.store.broadcastTool).toBe("sources");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

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

it("previews a plain setup draft without creating scenes and invalidates review when its prefix changes", async () => {
  const fixture = await workflowUiFixture();
  const preview = vi.fn(async () => ({
    id: "review",
    context: { epoch: 1, collection: 0, revision: 0 },
    input: { prefix: "CoForge", sources: [] },
    scenes: [{ role: "development" as const, name: "CoForge · Development" }],
    steps: ["Create scene: CoForge · Development"],
  }));
  const apply = vi.fn();
  const setup: ObsSetupActions = {
    preview,
    apply,
    snapshot: () => undefined,
    recover: async () => undefined,
  };
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      obsSetup: setup,
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
  const wrapper = mount(ObsStudioSetup, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  try {
    const ui = useObsSetupUi(fixture.pinia);
    expect(wrapper.text()).toContain(
      "Studio creation never starts a broadcast",
    );
    // The service preview works with plain data; authoring alone cannot create scenes.
    ui.preview = await setup.preview({ prefix: "CoForge", sources: [] });
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Review studio creation"]').text(),
    ).toContain("CoForge · Development");
    ui.confirmed = true;
    const prefix = wrapper
      .findAll("input")
      .find((input) => input.element.value === "CoForge")!;
    await prefix.setValue("Rehearsal");
    expect(ui.preview).toBeNull();
    expect(ui.confirmed).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
