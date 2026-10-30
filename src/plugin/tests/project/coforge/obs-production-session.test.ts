// @vitest-environment happy-dom
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";

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

it("refreshes retained show and overlay data without requesting frames or sending OBS mutations", async () => {
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
  fixture.store.broadcastTool = "show";
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
  const execute = vi.fn((input: unknown) =>
    adapter.execute(obsProductionActionCheck(input)),
  );
  const production: ObsProductionActions = {
    inspect,
    frame,
    execute,
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
  const timer = vi.spyOn(window, "setInterval");
  let refresh = async () => false;
  const Surface = defineComponent({
    setup() {
      refresh = useObsProductionSession().refresh;
      return () => h("div");
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
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(ui.snapshot?.inputs[0]?.audio.peakDb).toBeCloseTo(-6.02);
    observePeak(0.25);
    fixture.store.broadcastTool = "live";
    await flushPromises();
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(timer).not.toHaveBeenCalled();
    fixture.store.broadcastTool = "show";
    await flushPromises();
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(ui.snapshot?.inputs[0]?.audio.peakDb).toBeCloseTo(-12.04);
    await refresh();
    expect(inspect).toHaveBeenCalledTimes(3);
    for (const page of ["displays", "history", "setup"] as const) {
      fixture.store.broadcastTool = page;
      await flushPromises();
    }
    expect(inspect).toHaveBeenCalledTimes(6);
    await fixture.studio.store.transaction((state) => {
      state.settings.projectName = "Unrelated project edit";
    });
    await flushPromises();
    expect(inspect).toHaveBeenCalledTimes(6);
    fixture.store.view = "board";
    fixture.store.broadcastTool = "show";
    await flushPromises();
    expect(inspect).toHaveBeenCalledTimes(6);
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
    fixture.store.view = "broadcast";
    await flushPromises();
    expect(inspect).toHaveBeenCalledTimes(6);
    server.epoch = 2;
    await fixture.studio.store.updateRuntime({
      obs: {
        connection: "connected",
        snapshot: await server.snapshot(),
        busy: false,
        prepared: false,
        onBreak: false,
        uncertain: false,
      },
    });
    await flushPromises();
    expect(inspect).toHaveBeenCalledTimes(7);
    expect(ui.notice).toContain("Review the saved show actions");
    expect(frame).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    timer.mockRestore();
    await fixture.dispose();
  }
});
