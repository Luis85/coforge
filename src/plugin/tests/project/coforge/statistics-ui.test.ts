// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { expect, it } from "vitest";
import StreamStatisticsView from "../../../presentation/components/coforge/StreamStatisticsView.vue";
import StatisticsChart from "../../../presentation/components/coforge/StatisticsChart.vue";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import {
  summarizeStream,
  type StreamHistory,
} from "../../../features/coforge/domain/stream-metrics";
import { recordedStatistics } from "./statistics-fixtures";
import { MemoryStorage, nodeTimers } from "./memory-storage";

it("reads histories, compares earlier streams and ignores a delayed response for a previous selection", async () => {
  const timers = nodeTimers();
  const runner = createDemoRunner(timers);
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.start();
  const current = recordedStatistics("current", "2026-10-27T10:00:00Z");
  const older = recordedStatistics("older", "2026-10-26T10:00:00Z");
  let resolve!: (history: StreamHistory) => void;
  let delay = false;
  const delayed = new Promise<StreamHistory>((done) => {
    resolve = done;
  });
  const before = JSON.stringify([current, older]);
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => undefined,
    host: {
      streamHistory: {
        list: async () => [current, older].map(summarizeStream),
        read: async (id) =>
          id === "current" ? (delay ? delayed : current) : older,
        export: async () => "synthetic-export.json",
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
  const pinia = createPinia();
  const store = useStudioStore(pinia);
  store.state = studio.state();
  const wrapper = mount(StreamStatisticsView, {
    global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } },
  });
  try {
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Stream statistics");
    const overview = wrapper.get('[aria-label="Selected recording overview"]');
    expect(overview.text()).toContain("Mean observed viewers10");
    expect(overview.text()).toContain("20");
    expect(overview.text()).toContain("10");
    expect(
      wrapper.get('[aria-label="Selected metric coverage"]').text(),
    ).toContain("3 available");
    expect(wrapper.findAll(".cf-statistics-legend li")).toHaveLength(2);
    store.state!.runtime.streamRecording = {
      phase: "idle",
      message: "Earlier runtime notification",
      recent: [],
    };
    await flushPromises();
    expect(wrapper.findAll(".cf-statistics-legend li")).toHaveLength(2);
    expect(wrapper.find('svg[role="img"]').exists()).toBe(true);
    await wrapper
      .get('[aria-label="Statistics metric"]')
      .setValue("follower-change");
    expect(wrapper.find("svg title").text()).toContain(
      "Observed follower change",
    );
    expect(
      wrapper.get('[aria-label="Selected metric coverage"]').text(),
    ).toContain("Observed follower change");
    delay = true;
    const refresh = wrapper
      .findAll("button")
      .find((button) => button.text() === "Refresh statistics")!;
    await refresh.trigger("click");
    await flushPromises();
    await wrapper.get('[aria-label="Statistics stream"]').setValue("older");
    await flushPromises();
    resolve(current);
    await flushPromises();
    expect(store.statisticsStream).toBe("older");
    expect(wrapper.findAll(".cf-statistics-legend li")).toHaveLength(1);
    expect(wrapper.findComponent(StatisticsChart).props("series")[0]?.id).toBe(
      "older",
    );
    expect(JSON.stringify([current, older])).toBe(before);
    older.samples.forEach((sample) => {
      sample.twitch.viewers = null;
    });
    await wrapper.get('[aria-label="Statistics metric"]').setValue("viewers");
    await refresh.trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Selected recording overview"] dd').text(),
    ).toBe("Unavailable");
    expect(
      wrapper.get('[aria-label="Selected metric coverage"]').text(),
    ).toContain("0 available");
    expect(
      wrapper.get('[aria-label="Selected metric coverage"]').text(),
    ).toContain("3 unavailable");
  } finally {
    wrapper.unmount();
    store.dispose();
    disposePinia(pinia);
    await studio.stop();
  }
});
