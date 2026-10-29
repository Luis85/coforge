// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ObsProductionDesk from "../../../presentation/components/coforge/ObsProductionDesk.vue";
import ObsSourceEditor from "../../../presentation/components/coforge/ObsSourceEditor.vue";
import { useObsProductionUi } from "../../../presentation/stores/obs-production-ui";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { workflowUiFixture } from "./workflow-ui-fixture";
import type { ObsProductionSnapshot } from "../../../features/coforge/domain/obs-production";
import type { ObsProductionActions } from "../../../features/coforge/application/obs-production-workflow";
import { obsProductionActionCheck } from "../../../features/coforge/domain/obs-production-check";

it("explains the disconnected production desk without sending OBS mutations", async () => {
  const fixture = await workflowUiFixture();
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
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
  const wrapper = mount(ObsProductionDesk, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain("Program");
    expect(wrapper.text()).toContain("Preview");
    expect(wrapper.text()).toContain("Connect OBS");
    expect(wrapper.text()).toContain("Sampled images");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("reads sampled monitors, changes audio only on explicit input, and hides frames after disconnection", async () => {
  const fixture = await workflowUiFixture();
  const at = new Date().toISOString();
  const value: ObsProductionSnapshot = {
    context: { epoch: 1, collection: 0, revision: 0 },
    observedAt: at,
    broadcast: {
      epoch: 1,
      revision: 1,
      scenes: [{ id: "dev", name: "Development" }],
      programSceneId: "dev",
      active: true,
      reconnecting: false,
      transitioning: false,
      timecode: "00:01:00",
      observedAt: at,
    },
    available: ["input-mute", "input-volume", "record-start"],
    inputKinds: [],
    filterKinds: [],
    inputs: [
      {
        id: "mic",
        name: "Microphone",
        kind: "wasapi_input_capture",
        settings: {},
        audio: {
          muted: false,
          volumeDb: -12,
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
    recording: { active: false, paused: false, timecode: "" },
    replayBuffer: null,
    virtualCamera: null,
    video: null,
    recordDirectory: null,
    lastRecording: null,
    lastReplay: null,
  };
  const execute = vi.fn(async (input: unknown) => {
    const action = obsProductionActionCheck(input);
    if (action.kind === "input-mute")
      value.inputs[0]!.audio.muted = action.muted;
    return structuredClone(value);
  });
  let frameFailure = false;
  const production: ObsProductionActions = {
    acknowledgeOutputRestart: async () => structuredClone(value),
    inspect: vi.fn(async () => structuredClone(value)),
    execute,
    frame: async (sceneId) => {
      if (frameFailure) throw new Error("The image request failed.");
      return {
        sceneId,
        dataUrl: "data:image/png;base64,AAAA",
        observedAt: new Date().toISOString(),
        kind: "screenshot",
      };
    },
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
  const wrapper = mount(ObsProductionDesk, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  try {
    await flushPromises();
    expect(execute).not.toHaveBeenCalled();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Refresh monitors")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.find('img[alt="Sampled OBS program scene"]').exists()).toBe(
      true,
    );
    expect(execute).not.toHaveBeenCalled();
    await wrapper.get('button[aria-label="Mute Microphone"]').trigger("click");
    await flushPromises();
    expect(execute).toHaveBeenCalledExactlyOnceWith({
      kind: "input-mute",
      inputId: "mic",
      muted: true,
      expected: value.context,
    });
    expect(wrapper.get('button[aria-label="Unmute Microphone"]').text()).toBe(
      "Unmute",
    );
    frameFailure = true;
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Refresh monitors")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.find("img").exists()).toBe(false);
    frameFailure = false;
    value.inputs.push({
      id: "overlay",
      name: "Authenticated overlay",
      kind: "browser_source",
      settings: { url: "https://example.test/overlay?token=%5Bredacted%5D" },
      audio: {
        muted: null,
        volumeDb: null,
        monitor: null,
        syncOffset: null,
        tracks: null,
        peakDb: null,
        meterObservedAt: null,
      },
    });
    const editor = mount(ObsSourceEditor, {
      global: {
        plugins: [fixture.pinia],
        provide: { [coforgeKey as symbol]: context },
      },
    });
    try {
      await editor
        .findAll("button")
        .find((button) => button.text() === "Refresh sources")!
        .trigger("click");
      await flushPromises();
      useObsProductionUi(fixture.pinia).selectedInput = "overlay";
      await flushPromises();
      expect(editor.text()).toContain("This URL contains hidden credentials");
      expect(
        editor.get<HTMLInputElement>('input[type="url"]').element.value,
      ).toBe("");
      await editor
        .get('input[type="url"]')
        .setValue("https://example.test/overlay?token=%5Bredacted%5D");
      await editor
        .findAll("button")
        .find((button) => button.text() === "Apply browser URL")!
        .trigger("click");
      await flushPromises();
      expect(execute).toHaveBeenCalledTimes(1);
      const ui = useObsProductionUi(fixture.pinia);
      ui.transform = await production.transform("dev", 1);
      ui.transformRead = {
        sceneId: "dev",
        itemId: 1,
        context: { ...value.context },
      };
      value.context.epoch = 2;
      value.broadcast.epoch = 2;
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
      await editor
        .findAll("button")
        .find((button) => button.text() === "Refresh sources")!
        .trigger("click");
      await flushPromises();
      expect(ui.selectedInput).toBe("");
      expect(ui.transform).toBeNull();
      expect(ui.transformRead).toBeNull();
      expect(ui.sourceOptions).toEqual([]);
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      editor.unmount();
    }
    await fixture.studio.store.updateRuntime({
      obs: {
        connection: "disconnected",
        snapshot: value.broadcast,
        busy: false,
        prepared: false,
        onBreak: false,
        uncertain: false,
      },
    });
    await flushPromises();
    expect(wrapper.find("img").exists()).toBe(false);
    expect(
      wrapper
        .get('button[aria-label="Unmute Microphone"]')
        .attributes("disabled"),
    ).toBeDefined();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
