// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import CouncilView from "../../../presentation/components/coforge/CouncilView.vue";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { councilControlsFixture } from "./council-controls-fixture";

it.each([true, false])(
  "separates Council goals and preserves drafts (designated desktop: %s)",
  async (executor) => {
    const fixture = await councilControlsFixture(executor);
    const pinia = createPinia();
    useStudioStore(pinia).state = fixture.studio.state();
    const context: CoforgeContext = {
      studio: fixture.studio,
      startupError: () => null,
      onNotice: () => () => undefined,
      host: {
        council: fixture.module.actions,
        setSecret: () => false,
        hasSecret: () => false,
        openIdeaNote: async () => false,
        saveExport: async () => "private-export.json",
        publishBoard: async () => ({ folder: "", changed: false }),
        installPagesWorkflow: async () => ({
          folder: "",
          workflow: "",
          created: false,
        }),
      },
    };
    const wrapper = mount(CouncilView, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        provide: { [coforgeKey as symbol]: context },
        directives: { 'cf-icon': () => undefined },
      },
    });
    try {
      await flushPromises();
      const navigation = wrapper.get('nav[aria-label="Council workspace"]');
      const visit = async (name: string) => {
        const button = navigation
          .findAll("button")
          .find((item) => item.text() === name);
        if (!button) throw new Error(`Missing Council page ${name}`);
        await button.trigger("click");
        await flushPromises();
      };
      expect(
        wrapper.find('[aria-label="Council execution controls"]').isVisible(),
      ).toBe(true);
      if (!executor) {
        await visit("Submit existing note");
        const prerequisite = wrapper.get(
          '[aria-label="Council execution prerequisite"]',
        );
        expect(prerequisite.text()).toContain("designate this desktop");
        await prerequisite.get("button").trigger("click");
        await flushPromises();
        expect(
          wrapper.get('[aria-label="Council execution controls"]').isVisible(),
        ).toBe(true);
        expect(fixture.module.actions.snapshot().executor).toBe(false);
        expect(fixture.module.actions.snapshot().runs).toHaveLength(0);
      }
      await visit("Definition folders");
      const folder = wrapper.get(
        'input[aria-label="CoWorker definitions folder"]',
      );
      expect(folder.isVisible()).toBe(true);
      await folder.setValue("Private/Specialists");
      await visit("Run monitor");
      expect(
        wrapper.get('[aria-label="Council execution controls"]').isVisible(),
      ).toBe(true);
      expect(folder.isVisible()).toBe(false);
      await visit("Definition folders");
      expect(folder.element).toHaveProperty("value", "Private/Specialists");
      expect(
        fixture.module.actions.snapshot().preferences.definitionFolders?.agents,
      ).not.toBe("Private/Specialists");
      expect(fixture.module.actions.snapshot().paused).toBe(true);
      expect(fixture.module.actions.snapshot().runs).toHaveLength(0);
    } finally {
      wrapper.unmount();
      disposePinia(pinia);
      await fixture.dispose();
    }
  },
);
