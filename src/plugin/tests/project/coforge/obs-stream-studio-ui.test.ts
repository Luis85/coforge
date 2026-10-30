// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import BroadcastView from "../../../presentation/components/coforge/BroadcastView.vue";
import ObsLiveDock from "../../../presentation/components/coforge/ObsLiveDock.vue";
import ObsSceneSources from "../../../presentation/components/coforge/ObsSceneSources.vue";
import { workflowUiFixture } from "./workflow-ui-fixture";
import { emptyObsShow } from "../../../features/coforge/domain/obs-show";

it("keeps stream controls, Show plan second and scene editing while omitting OBS settings and monitors", async () => {
  const fixture = await workflowUiFixture();
  fixture.store.view = "broadcast";
  const wrapper = mount(BroadcastView, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await flushPromises();
    const navigation = wrapper.get('nav[aria-label="Stream studio pages"]');
    expect(navigation.findAll("button").map((button) => button.text())).toEqual(
      [
        "Broadcast",
        "Show plan",
        "Setup",
        "Scenes",
        "Music",
        "Public displays",
        "History",
      ],
    );
    expect(
      wrapper.find('section[aria-label="Live production desk"]').exists(),
    ).toBe(false);
    expect(wrapper.find('section[aria-label="OBS audio mixer"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('section[aria-label="Create my studio"]').exists(),
    ).toBe(false);
    expect(
      wrapper
        .find('section[aria-label="Source properties and layouts"]')
        .exists(),
    ).toBe(false);
    expect(
      wrapper.find('section[aria-label="OBS video and output setup"]').exists(),
    ).toBe(false);
    expect(wrapper.find('img[alt="Sampled OBS program scene"]').exists()).toBe(
      false,
    );
    expect(wrapper.find(".cf-production-live-summary").exists()).toBe(false);
    expect(wrapper.findAll('section[aria-label="Live OBS health"]')).toHaveLength(1);
    expect(
      wrapper.find('section[aria-label="OBS connection and scenes"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('section[aria-label="Show plans and cues"]').exists(),
    ).toBe(true);
    await navigation
      .findAll("button")
      .find((button) => button.text() === "Scenes")!
      .trigger("click");
    expect(fixture.store.broadcastTool).toBe("scenes");
    expect(fixture.store.obsEditorOpen).toBe(true);
    expect(
      wrapper.get("details.cf-obs-scene-manager").attributes("open"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("Go live");
    expect(wrapper.text()).toContain("Stop stream");
    await fixture.studio.store.transaction((state) => {
      state.obsShow = { ...emptyObsShow(), outputRestartRequired: true };
    });
    await flushPromises();
    const restartReview = wrapper.get(
      'section[aria-label="OBS restart review"]',
    );
    expect(restartReview.text()).toContain("previously saved output change");
    expect(restartReview.get("button").attributes("disabled")).toBeDefined();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("opens the retained Show plan from live quick controls without changing OBS", async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.updateRuntime({
    obs: {
      connection: "connected",
      busy: false,
      prepared: true,
      onBreak: false,
      uncertain: false,
      snapshot: {
        epoch: 1,
        revision: 1,
        scenes: [{ id: "game", name: "Game" }],
        programSceneId: "game",
        active: true,
        reconnecting: false,
        transitioning: false,
        timecode: "00:00:00",
        observedAt: new Date().toISOString(),
      },
    },
  });
  const wrapper = mount(ObsLiveDock, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    expect(
      wrapper.find('button[aria-label="Open the OBS audio mixer"]').exists(),
    ).toBe(false);
    await wrapper
      .get('button[aria-label="Open the show plan"]')
      .trigger("click");
    expect(fixture.store.view).toBe("broadcast");
    expect(fixture.store.broadcastTool).toBe("show");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("exposes scene item IDs for saved visibility cues while retaining explicit source controls", async () => {
  const item = {
    id: 17,
    name: "Game capture",
    sourceId: "game",
    kind: "input",
    enabled: true,
    locked: false,
    index: 0,
  } as const;
  const wrapper = mount(ObsSceneSources, {
    props: {
      disabled: false,
      detail: {
        context: { epoch: 1, collection: 0, revision: 1 },
        sceneId: "development",
        name: "Development",
        items: [item],
        sources: [],
        available: ["item-visible"],
        observedAt: new Date().toISOString(),
      },
    },
  });
  try {
    expect(wrapper.text()).toContain("Item 17");
    await wrapper
      .get('button[aria-label="Hide source Game capture"]')
      .trigger("click");
    expect(wrapper.emitted("visible")).toEqual([[item]]);
  } finally {
    wrapper.unmount();
  }
});
