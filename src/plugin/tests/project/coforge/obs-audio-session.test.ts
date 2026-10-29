// @vitest-environment happy-dom
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ObsAudioMixer from "../../../presentation/components/coforge/ObsAudioMixer.vue";
import { useObsProductionSession } from "../../../presentation/composables/coforge/use-obs-production";
import { useObsProductionUi } from "../../../presentation/stores/obs-production-ui";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { ObsProductionAdapter } from "../../../infrastructure/coforge/obs-production-adapter";
import { PRODUCTION_REQUESTS } from "../../../infrastructure/coforge/obs-production-rpc";
import { obsProductionActionCheck } from "../../../features/coforge/domain/obs-production-check";
import type { ObsProductionActions } from "../../../features/coforge/application/obs-production-workflow";
import { ObsProductionServer } from "../../support/coforge/obs-production-server";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("refreshes sampled audio levels on the Audio page without fetching video, and hides disconnected meter values", async () => {
  const fixture = await workflowUiFixture();
  const server = new ObsProductionServer();
  const adapter = new ObsProductionAdapter(
    server,
    server.snapshot,
    () => new Set(PRODUCTION_REQUESTS),
    server.context,
    server.secrets,
  );
  await adapter.inspect();
  const observePeak = (peak: number) =>
    adapter.observe("InputVolumeMeters", {
      inputs: [
        { inputUuid: "microphone", inputLevelsMul: [[peak, peak, peak]] },
      ],
    });
  observePeak(0.5);
  const initial = await adapter.inspect();
  const ui = useObsProductionUi(fixture.pinia);
  ui.snapshot = initial;
  fixture.store.view = "broadcast";
  fixture.store.broadcastTool = "audio";
  await fixture.studio.store.updateRuntime({
    obs: {
      connection: "connected",
      snapshot: initial.broadcast,
      busy: false,
      prepared: false,
      onBreak: false,
      uncertain: false,
    },
  });
  const inspect = vi.fn(() => adapter.inspect());
  const frame = vi.fn((id: string) => adapter.frame(id));
  const production: ObsProductionActions = {
    inspect,
    frame,
    execute: (input) => adapter.execute(obsProductionActionCheck(input)),
    properties: (id, property) => adapter.properties(id, property),
    transform: (id, item) => adapter.transform(id, item),
    filters: (id) => adapter.filters(id),
    saveOutputSecret: (name, value) => adapter.saveOutputSecret(name, value),
    acknowledgeOutputRestart: () => adapter.inspect(),
  };
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
  let tick = () => {};
  const timer = vi
    .spyOn(window, "setInterval")
    .mockImplementation((handler) => {
      if (typeof handler === "function") tick = () => handler();
      return 42;
    });
  const clear = vi.spyOn(window, "clearInterval").mockImplementation(() => {});
  const Surface = defineComponent({
    setup() {
      useObsProductionSession();
      return () => h(ObsAudioMixer);
    },
  });
  const wrapper = mount(Surface, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain("-6.0 dBFS");
    observePeak(0.25);
    tick();
    await flushPromises();
    expect(wrapper.text()).toContain("-12.0 dBFS");
    expect(inspect).toHaveBeenCalled();
    expect(frame).not.toHaveBeenCalled();
    await fixture.studio.store.updateRuntime({
      obs: {
        connection: "disconnected",
        snapshot: initial.broadcast,
        busy: false,
        prepared: false,
        onBreak: false,
        uncertain: false,
      },
    });
    await flushPromises();
    expect(wrapper.find("meter").exists()).toBe(false);
  } finally {
    wrapper.unmount();
    timer.mockRestore();
    clear.mockRestore();
    await fixture.dispose();
  }
});
