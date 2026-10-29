// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ObsOverlayComposer from "../../../presentation/components/coforge/ObsOverlayComposer.vue";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { useObsOverlayUi } from "../../../presentation/stores/obs-overlay-ui";
import {
  obsOverlayDefinitionCheck,
  type ObsOverlayDefinition,
} from "../../../features/coforge/domain/obs-overlay";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("loads public choices and requires captured text review before an OBS overlay publication", async () => {
  const fixture = await workflowUiFixture();
  const publish = vi.fn(async () => []);
  const refreshOverlay = vi.fn(async () => {});
  let definition: ObsOverlayDefinition | undefined;
  const preview = vi.fn(async (input: unknown) => {
    definition = obsOverlayDefinitionCheck(input);
    return {
      id: "captured-overlay",
      definition,
      text: "CF-101 · Add a lantern",
      inputName: "Request title",
      shared: true,
      onAir: true,
      switchesFromFile: false,
    };
  });
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      obsOverlays: {
        snapshot: () => [],
        candidates: async () => ({
          projects: [{ id: "public-project", name: "Public game" }],
          requests: [{ id: "CF-101", name: "CF-101 · Add a lantern" }],
          increments: [],
          recognition: [],
          inputs: [{ id: "request-text", name: "Request title" }],
        }),
        preview,
        publish,
        refreshOverlay,
        clear: async () => {},
        remove: async () => {},
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
  await fixture.studio.store.updateRuntime({
    obs: {
      connection: "connected",
      busy: false,
      prepared: false,
      onBreak: false,
      uncertain: false,
    },
  });
  const wrapper = mount(ObsOverlayComposer, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  const button = (name: string) =>
    wrapper.findAll("button").find((item) => item.text() === name)!;
  try {
    await flushPromises();
    expect(preview).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(refreshOverlay).not.toHaveBeenCalled();
    await button("Load public overlay choices").trigger("click");
    await flushPromises();
    const ui = useObsOverlayUi(fixture.pinia);
    ui.projectId = "public-project";
    await flushPromises();
    await button("Load selected project content").trigger("click");
    await flushPromises();
    ui.name = "Current request";
    ui.inputId = "request-text";
    ui.subjectId = "CF-101";
    ui.publicConfirmed = true;
    await flushPromises();
    await button("Preview public overlay text").trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Review outgoing public overlay"]').text(),
    ).toContain("CF-101 · Add a lantern");
    expect(wrapper.text()).toContain("currently on air");
    expect(publish).not.toHaveBeenCalled();
    ui.name = "Renamed overlay";
    await flushPromises();
    expect(
      wrapper.find('[aria-label="Review outgoing public overlay"]').exists(),
    ).toBe(false);
    await button("Preview public overlay text").trigger("click");
    await flushPromises();
    ui.reviewed = true;
    await flushPromises();
    await button("Publish reviewed overlay").trigger("click");
    await flushPromises();
    expect(publish).toHaveBeenCalledExactlyOnceWith({
      previewId: "captured-overlay",
      confirmed: true,
    });
    expect(definition?.publicConfirmed).toBe(true);
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
