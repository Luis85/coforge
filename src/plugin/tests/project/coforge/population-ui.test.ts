// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, disposePinia, type Pinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { disconnectedTwitch, type TwitchActions } from "../../../features/coforge/domain/twitch";
import PopulationView from "../../../presentation/components/coforge/PopulationView.vue";
import CommunitySettingsView from "../../../presentation/components/coforge/CommunitySettingsView.vue";
import { coforgeKey, type CoforgeContext } from "../../../presentation/context/coforge-context";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { MemoryStorage, nodeTimers } from "./memory-storage";

const mounted: Array<{ wrapper: VueWrapper; pinia: Pinia; studio: StudioService; stop: () => void }> = [];
afterEach(async () => {
  for (const { wrapper, pinia, studio, stop } of mounted.splice(0)) {
    stop();
    wrapper.unmount();
    useStudioStore(pinia).dispose();
    disposePinia(pinia);
    await studio.stop();
  }
});
async function render(settings = false) {
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
  });
  await studio.start();
  await studio.updateIntegration({ twitchBroadcasterId: "123" });
  await studio.ingest({ username: "Viewer", source: "twitch", userId: "99", text: "!register" });
  await studio.store.updateRuntime({
    twitch: {
      ...disconnectedTwitch(),
      phase: "connected",
      canModerate: true,
      streamer: { id: "123", login: "streamer", scopes: [] },
    },
  });
  const moderate = vi.fn<TwitchActions["moderate"]>(async () => undefined);
  const twitch: TwitchActions = {
    moderate,
    send: async () => undefined,
    authorize: async () => undefined,
    cancelAuthorization: () => undefined,
    reconnect: async () => undefined,
    refreshChannel: async () => undefined,
    updateChannel: async () => undefined,
    searchCategories: async () => [],
    resolveUser: async (login) => ({ id: "99", login }),
    retryReply: async () => undefined,
  };
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => undefined,
    host: {
      twitch,
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => true,
      saveExport: async () => "export.json",
      publishBoard: async () => ({ folder: "CoForge/Public", changed: false }),
      installPagesWorkflow: async () => ({ workflow: "", folder: "", created: false }),
    },
  };
  const pinia = createPinia();
  const store = useStudioStore(pinia);
  const stop = studio.subscribe((state) => {
    store.state = state;
  });
  if (settings) store.view = "community-settings";
  const wrapper = mount(settings ? CommunitySettingsView : PopulationView, {
    global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } },
  });
  mounted.push({ wrapper, pinia, studio, stop });
  await flushPromises();
  return { wrapper, studio, store, moderate };
}
const button = (wrapper: VueWrapper, text: string) => {
  const found = wrapper.findAll("button").find((button) => button.text() === text);
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
};
describe("population and community operator workflows", () => {
  it("does not moderate before confirmation and sends the reviewed timeout despite later draft edits", async () => {
    const env = await render();
    await env.wrapper.get(".cf-player-name").trigger("click");
    await flushPromises();
    await env.wrapper.get('button[aria-label="Mute"]').trigger("click");
    expect(env.moderate).not.toHaveBeenCalled();
    expect(env.wrapper.get('[aria-label="Confirm player action"]').text()).toContain("600 seconds");
    await env.wrapper.get('input[type="number"]').setValue(900);
    await button(env.wrapper, "Confirm mute").trigger("click");
    await flushPromises();
    expect(env.moderate).toHaveBeenCalledExactlyOnceWith({ type: "timeout", userId: "99", duration: 600, reason: "" });
  });
  it("keeps an invalid settings draft and protects it from navigation until saved or discarded", async () => {
    const env = await render(true);
    const names = env.wrapper.get('[aria-label="Environment names"]').findAll("input");
    await names[0]!.setValue("Citizen");
    await names[1]!.setValue("credits");
    await button(env.wrapper, "Add rank").trigger("click");
    const ranks = env.wrapper.get('[aria-label="Named rank ladder"]');
    await ranks.findAll('input[type="text"]')[1]!.setValue("Builder");
    await ranks.findAll('input[type="number"]')[1]!.setValue(0);
    env.store.navigate("board");
    expect(env.store.view).toBe("community-settings");
    await env.wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(env.wrapper.get('[role="alert"]').text()).toContain("unique");
    expect(env.studio.state().population?.environment.currencyName).toBe("gold");
    expect(names[1]!.element.value).toBe("credits");
    await ranks.findAll('input[type="number"]')[1]!.setValue(200);
    await env.wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(env.studio.state().population?.environment).toMatchObject({
      actorName: "Citizen",
      currencyName: "credits",
      ranks: [
        { name: "Agent", minimumXp: 0 },
        { name: "Builder", minimumXp: 200 },
      ],
    });
    env.store.navigate("board");
    expect(env.store.view).toBe("board");
  });
});
