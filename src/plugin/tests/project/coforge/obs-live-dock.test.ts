// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ObsLiveDock from "../../../presentation/components/coforge/ObsLiveDock.vue";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { workflowUiFixture } from "./workflow-ui-fixture";
import { defaultObsSettings } from "../../../features/coforge/domain/obs";

it("keeps live controls available across work views and distinguishes a disconnected last observation", async () => {
  const fixture = await workflowUiFixture();
  const pause = vi.fn(async () => {});
  const goLive = vi.fn(async () => {});
  const obs = {
    detect: async () => {},
    open: async () => {},
    configure: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    refresh: async () => {},
    prepare: async () => {},
    goLive,
    pause,
    resume: async () => {},
    stop: async () => {},
    setPassword: async () => {},
  };
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      obs,
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
  const wrapper = mount(ObsLiveDock, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  try {
    expect(
      wrapper.find('[aria-label="Broadcast quick controls"]').exists(),
    ).toBe(false);
    await fixture.studio.store.transaction((state) => {
      state.obsSettings = {
        ...defaultObsSettings(),
        liveSceneId: "dev",
        breakSceneId: "brb",
      };
    });
    await fixture.studio.store.updateRuntime({
      obs: {
        connection: "connected",
        busy: false,
        prepared: false,
        onBreak: false,
        uncertain: false,
        snapshot: {
          epoch: 1,
          revision: 1,
          scenes: [{ id: "dev", name: "Development" }],
          programSceneId: "dev",
          active: true,
          reconnecting: false,
          transitioning: false,
          timecode: "00:02:00",
          observedAt: new Date().toISOString(),
        },
      },
    });
    fixture.store.view = "board";
    await flushPromises();
    expect(wrapper.text()).toContain("Development");
    await wrapper.get('[aria-label="Take a stream break"]').trigger("click");
    await flushPromises();
    expect(pause).toHaveBeenCalledOnce();
    expect(goLive).not.toHaveBeenCalled();
    const state = fixture.studio.state().runtime.obs!;
    await fixture.studio.store.updateRuntime({
      obs: { ...state, connection: "disconnected" },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Last seen live");
    expect(
      wrapper.get('[aria-label="Take a stream break"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.get('[aria-label="Open the live desk"]').trigger("click");
    expect(fixture.store.view).toBe("broadcast");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
