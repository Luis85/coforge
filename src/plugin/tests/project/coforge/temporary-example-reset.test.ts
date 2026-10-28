// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { defineComponent, h } from "vue";
import { expect, it, vi } from "vitest";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { useTemporaryExample } from "../../../presentation/composables/coforge/use-temporary-example";

it("closes active examples on explicit cleanup and stale examples on remount, preserving ordinary navigation", () => {
  const pinia = createPinia();
  const studio = useStudioStore(pinia);
  const exit = vi.fn();
  let begin = () => {};
  const Panel = defineComponent({
    setup() {
      begin = useTemporaryExample("test", exit);
      return () => h("p", "Temporary example");
    },
  });
  const first = mount(Panel, { global: { plugins: [pinia] } });
  begin();
  first.unmount();
  expect(exit).not.toHaveBeenCalled();
  const second = mount(Panel, { global: { plugins: [pinia] } });
  expect(exit).not.toHaveBeenCalled();
  studio.closeTemporaryExamples();
  expect(exit).toHaveBeenCalledTimes(1);
  begin();
  second.unmount();
  studio.closeTemporaryExamples();
  expect(exit).toHaveBeenCalledTimes(1);
  const third = mount(Panel, { global: { plugins: [pinia] } });
  expect(exit).toHaveBeenCalledTimes(2);
  third.unmount();
  disposePinia(pinia);
});

it("restores manually authored scene drafts after the temporary studio example", () => {
  const pinia = createPinia();
  const studio = useStudioStore(pinia);
  studio.obsEditorScene = "actual-scene";
  studio.obsNewSceneName = "Keep my planned scene";
  studio.obsCopySceneName = "Keep my duplicate draft";
  studio.beginStudioExample();
  studio.obsEditorScene = "example-scene";
  studio.obsNewSceneName = "Discard example scene";
  studio.obsCopySceneName = "Discard example duplicate";
  studio.exitStudioExample();
  expect(studio.studioExampleEnabled).toBe(false);
  expect(studio.obsEditorScene).toBe("actual-scene");
  expect(studio.obsNewSceneName).toBe("Keep my planned scene");
  expect(studio.obsCopySceneName).toBe("Keep my duplicate draft");
  studio.exitStudioExample();
  expect(studio.obsNewSceneName).toBe("Keep my planned scene");
  disposePinia(pinia);
});
