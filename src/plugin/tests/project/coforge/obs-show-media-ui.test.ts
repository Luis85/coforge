// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import ObsShowPlan from "../../../presentation/components/coforge/ObsShowPlan.vue";
import { useObsProductionUi } from "../../../presentation/stores/obs-production-ui";
import { useObsShowUi } from "../../../presentation/stores/obs-show-ui";
import { ObsShowWorkflow } from "../../../features/coforge/application/obs-show-workflow";
import { ObsShowProductionExecutor } from "../../../features/coforge/application/obs-show-executor";
import type { ObsProductionActions } from "../../../features/coforge/application/obs-production-workflow";
import { obsProductionActionCheck } from "../../../features/coforge/domain/obs-production-check";
import { ObsProductionAdapter } from "../../../infrastructure/coforge/obs-production-adapter";
import { PRODUCTION_REQUESTS } from "../../../infrastructure/coforge/obs-production-rpc";
import { ObsProductionServer } from "../../support/coforge/obs-production-server";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("rejects a hidden camera target and runs saved Media/VLC cues only on explicit execution", async () => {
  const fixture = await workflowUiFixture();
  const server = new ObsProductionServer();
  server.inputs = [
    { inputUuid: "camera", inputName: "Camera", inputKind: "dshow_input" },
    {
      inputUuid: "music",
      inputName: "Media music",
      inputKind: "ffmpeg_source",
    },
    {
      inputUuid: "playlist",
      inputName: "VLC playlist",
      inputKind: "vlc_source",
    },
  ];
  const adapter = new ObsProductionAdapter(
    server,
    server.snapshot,
    () => new Set(PRODUCTION_REQUESTS),
    server.context,
    server.secrets,
  );
  const production: ObsProductionActions = {
    inspect: () => adapter.inspect(),
    execute: (input) => adapter.execute(obsProductionActionCheck(input)),
    frame: (id) => adapter.frame(id),
    properties: (id, property) => adapter.properties(id, property),
    transform: (id, item) => adapter.transform(id, item),
    filters: (id) => adapter.filters(id),
    saveOutputSecret: (name, value) => adapter.saveOutputSecret(name, value),
    acknowledgeOutputRestart: () => adapter.inspect(),
  };
  const show = new ObsShowWorkflow(
    fixture.studio.store,
    new ObsShowProductionExecutor(
      production,
      {
        execute: async () => {
          throw new Error("No scene change expected");
        },
      },
      () => true,
    ),
  );
  await show.start();
  fixture.context.host.obsProduction = production;
  fixture.context.host.obsShow = show;
  const initial = await adapter.inspect();
  useObsProductionUi(fixture.pinia).snapshot = initial;
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
  const wrapper = mount(ObsShowPlan, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  const button = (name: string) => {
    const match = wrapper
      .findAll("button")
      .find((item) => item.text() === name);
    if (!match) throw new Error(`Missing button: ${name}`);
    return match;
  };
  const field = (name: string) => {
    const match = wrapper
      .findAll("label")
      .find((item) => item.find("span").text() === name);
    if (!match) throw new Error(`Missing field: ${name}`);
    return match.get("select");
  };
  try {
    await button("Create show plan").trigger("click");
    const ui = useObsShowUi(fixture.pinia);
    await field("Action to add").setValue("mute");
    await field("Target input").setValue("camera");
    await field("Action to add").setValue("media");
    expect(
      field("Target input")
        .findAll("option")
        .map((option) => option.attributes("value")),
    ).toEqual(["", "music", "playlist"]);
    await button("Add action to cue").trigger("click");
    expect(ui.draft?.segments[0]?.steps).toEqual([]);
    expect(ui.error).toContain("Choose an available OBS Media or VLC source");
    await field("Target input").setValue("music");
    await field("Media action").setValue("restart");
    await button("Add action to cue").trigger("click");
    await field("Target input").setValue("playlist");
    await field("Media action").setValue("pause");
    await button("Add action to cue").trigger("click");
    await button("Save show plan").trigger("click");
    await flushPromises();
    expect(show.snapshot().plans[0]?.segments[0]?.steps).toEqual([
      { kind: "media", inputId: "music", action: "restart" },
      { kind: "media", inputId: "playlist", action: "pause" },
    ]);
    expect(
      server.requests.every((request) => request.type.startsWith("Get")),
    ).toBe(true);
    await button("Run selected cue").trigger("click");
    await flushPromises();
    expect(
      server.requests
        .filter((request) => request.type === "TriggerMediaInputAction")
        .map((request) => request.data),
    ).toEqual([
      {
        inputName: "Media music",
        mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART",
      },
      {
        inputName: "VLC playlist",
        mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE",
      },
    ]);
    expect(show.snapshot().run?.status).toBe("confirmed");
  } finally {
    wrapper.unmount();
    show.dispose();
    adapter.dispose();
    await fixture.dispose();
  }
});
