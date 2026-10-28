// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { defineComponent, h, nextTick, type Plugin } from "vue";
import { expect, it, vi } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import {
  useSettings,
  type SettingsModel,
} from "../../../presentation/composables/coforge/use-settings";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { MemoryStorage, nodeTimers } from "./memory-storage";

it("preserves a dirty step-agent draft and rejects stale saves until the newest source is discarded into the form", async () => {
  const timers = nodeTimers();
  const storage = new MemoryStorage();
  const runner = vi.fn(async () => ({}));
  const studio = new StudioService(storage, {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => false,
      saveExport: async () => "not-written.json",
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
  const binding: { model?: SettingsModel } = {};
  const Probe = defineComponent({
    setup() {
      const model = useSettings();
      binding.model = model;
      return () =>
        h("form", { onSubmit: model.submit }, [
          model.error ? h("p", { role: "alert" }, model.error) : null,
          h("button", { type: "submit" }, "Save settings"),
          h(
            "button",
            { type: "button", onClick: model.discard },
            "Discard changes",
          ),
        ]);
    },
  });
  const provider: Plugin = {
    install(app) {
      app.provide(coforgeKey, context);
    },
  };
  let stop = () => {};
  let unmount = () => {};
  try {
    await studio.start();
    const project = await studio.createProject({
      projectName: "Settings draft fixture",
      projectBrief:
        "Preserve local workflow choices while canonical project settings change.",
      projectPath: "/synthetic/settings-draft",
    });
    store.state = studio.state();
    stop = studio.subscribe((state) => {
      store.state = state;
    });
    const wrapper = mount(Probe, { global: { plugins: [pinia, provider] } });
    unmount = () => wrapper.unmount();
    const model = binding.model;
    if (!model) throw new Error("Settings model did not mount.");
    expect(model.dirty).toBe(false);
    model.draft.stageAgents.screen.provider = "claude";
    model.draft.stageAgents.screen.model = "haiku";
    await nextTick();
    expect(model.dirty).toBe(true);

    await studio.updateProject({ model: "opus" }, project.id);
    await flushPromises();
    expect(studio.state().settings.model).toBe("opus");
    expect(model.draft.stageAgents.screen).toEqual({
      provider: "claude",
      model: "haiku",
    });
    expect(model.draft.model).toBe("sonnet");
    expect(model.dirty).toBe(true);
    const writes = storage.saves;
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(storage.saves).toBe(writes);
    expect(studio.state().settings.model).toBe("opus");
    expect(studio.state().settings.stageAgents?.screen).toBeUndefined();
    expect(model.draft.stageAgents.screen).toEqual({
      provider: "claude",
      model: "haiku",
    });
    expect(wrapper.get('[role="alert"]').text()).toMatch(
      /changed.*outside|outside.*changed/i,
    );

    await wrapper.get('button[type="button"]').trigger("click");
    await flushPromises();
    expect(model.draft.model).toBe("opus");
    expect(model.draft.stageAgents.screen).toEqual({ provider: "", model: "" });
    expect(model.dirty).toBe(false);
    expect(store.dirtySettings).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(runner).not.toHaveBeenCalled();
    const same = studio.state().settings;
    const other = await studio.createProject({
      ...same,
      projectPath: project.projectPath,
    });
    await studio.selectProject(project.id);
    await flushPromises();
    model.draft.stageAgents.screen = { provider: "claude", model: "haiku" };
    await nextTick();
    await studio.selectProject(other.id);
    await flushPromises();
    const beforeWrongProjectSave = storage.saves;
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(storage.saves).toBe(beforeWrongProjectSave);
    expect(studio.state().settings.stageAgents?.screen).toBeUndefined();
    expect(model.draft.stageAgents.screen).toEqual({
      provider: "claude",
      model: "haiku",
    });
    expect(model.error).toMatch(/changed.*outside|outside.*changed/i);
    model.discard();
    await flushPromises();
    const update = studio.updateProject.bind(studio);
    vi.spyOn(studio, "updateProject").mockImplementationOnce(async () => {
      await update({ model: "sonnet" }, other.id);
      await nextTick();
      throw new Error("Synthetic save failure after an external update.");
    });
    model.draft.stageAgents.screen = { provider: "claude", model: "haiku" };
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(model.draft.stageAgents.screen).toEqual({
      provider: "claude",
      model: "haiku",
    });
    expect(model.draft.model).toBe("opus");
    expect(model.dirty).toBe(true);
    expect(studio.state().settings.model).toBe("sonnet");
    expect(model.error).toBeTruthy();
    model.discard();
    await flushPromises();
    expect(model.draft.model).toBe("sonnet");
    expect(model.dirty).toBe(false);
  } finally {
    unmount();
    stop();
    store.dispose();
    disposePinia(pinia);
    await studio.stop();
  }
});
