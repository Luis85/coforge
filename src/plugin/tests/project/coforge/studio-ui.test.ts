// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, disposePinia, type Pinia } from "pinia";
import { afterEach, describe, expect, it } from "vitest";
import type { Directive } from "vue";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { StudioService } from "../../../features/coforge/application/studio";
import StudioApp from "../../../presentation/components/coforge/StudioApp.vue";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { MemoryStorage, nodeTimers } from "./memory-storage";
import { createSeed } from "../../../features/coforge/domain/seed";

const icon: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.dataset.icon = binding.value;
  },
};
const mounted: Array<{
  wrapper: VueWrapper;
  pinia: Pinia;
  studio: StudioService;
}> = [];
afterEach(async () => {
  for (const { wrapper, pinia, studio } of mounted.splice(0)) {
    wrapper.unmount();
    disposePinia(pinia);
    await studio.stop();
  }
});

async function render(seed = true) {
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(
    new MemoryStorage(seed ? createSeed() : null),
    {
      runners: { demo: runner, claude: runner },
      timers,
      probeRuntime: () =>
        Promise.resolve({
          cliAvailable: false,
          projectPath: null,
          allowImplementation: false,
        }),
    },
  );
  await studio.start();
  const errors: unknown[] = [];
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => undefined,
    host: {
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: () => Promise.resolve(true),
      saveExport: () => Promise.resolve("export.json"),
      publishBoard: () =>
        Promise.resolve({ folder: "CoForge/Public", changed: true }),
      installPagesWorkflow: () =>
        Promise.resolve({ workflow: "", folder: "", created: true }),
    },
  };
  const pinia = createPinia();
  const wrapper = mount(StudioApp, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      provide: { [coforgeKey as symbol]: context },
      directives: { "cf-icon": icon },
      config: {
        errorHandler: (error) => {
          errors.push(error);
        },
      },
    },
  });
  mounted.push({ wrapper, pinia, studio });
  await flushPromises();
  return { wrapper, studio, errors };
}
const nav = (wrapper: VueWrapper, label: string) =>
  wrapper.get(`.cf-sidebar button[title="${label}"]`);

describe("CoForge studio view", () => {
  it("renders the board with the sample workspace and every studio view without errors", async () => {
    const { wrapper, errors } = await render();
    expect(wrapper.find(".cf-sidebar").text()).toContain("Mosslight");
    expect(wrapper.find(".cf-topbar strong").text()).toBe("Stream studio");
    await nav(wrapper, "Idea board").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Let us pet the forest foxes");
    for (const label of [
      "Stream chat",
      "Agent workflow",
      "Community",
      "Project settings",
      "Idea board",
    ]) {
      await nav(wrapper, label).trigger("click");
      await flushPromises();
      expect(wrapper.find(".cf-topbar strong").text()).toBe(
        label === "Project settings" ? "Settings" : label,
      );
    }
    expect(errors).toEqual([]);
  });

  it("offers the sample workspace on an empty board and loads it on confirmation", async () => {
    const { wrapper, studio, errors } = await render(false);
    await wrapper.get(".cf-project-switcher").trigger("click");
    const load = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Load sample workspace"));
    expect(load).toBeDefined();
    await load!.trigger("click");
    const confirm = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Replace with sample"));
    await confirm!.trigger("click");
    await flushPromises();
    expect(studio.state().ideas).toHaveLength(15);
    expect(wrapper.text()).toContain("Let us pet the forest foxes");
    expect(errors).toEqual([]);
  });

  it("opens an idea in the drawer and closes it with Escape", async () => {
    const { wrapper, studio, errors } = await render();
    const pinia = mounted.at(-1)!.pinia;
    const { useStudioStore } =
      await import("../../../presentation/stores/coforge-studio");
    useStudioStore(pinia).select("CF-101");
    await flushPromises();
    const drawer = wrapper.get(".cf-idea-drawer");
    expect(drawer.text()).toContain("CF-101");
    await drawer.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find(".cf-idea-drawer").exists()).toBe(false);
    expect(studio.state().ideas).toHaveLength(15);
    expect(errors).toEqual([]);
  });
});
