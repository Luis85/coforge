// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import PluginSettings from "../../../presentation/components/coforge/PluginSettings.vue";
import SettingsView from "../../../presentation/components/coforge/SettingsView.vue";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("saves a native worker Node path before a separate readiness check that does not admit a Build", async () => {
  const f = await workflowUiFixture();
  const check = vi
    .spyOn(f.studio, "refreshDurableBuildRuntime")
    .mockImplementation(async () => {
      const readiness = {
        ready: true,
        message: "Native Node and the pinned background worker are verified.",
      };
      await f.studio.store.updateRuntime({ durableBuild: readiness });
      return readiness;
    });
  const wrapper = mount(PluginSettings, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.findAll('h3').some(heading => heading.text() === 'Advanced background worker (optional)')).toBe(true);
    expect(wrapper.text()).toContain('Ordinary native agent sessions, including refinement and code improvements, do not require this worker.');
    const node = wrapper.get('[aria-label="Worker Node executable"]');
    await node.setValue("C:/Runtime/node.exe");
    const button = wrapper
      .findAll("button")
      .find((item) => item.text() === "Check background worker")!;
    expect(button.attributes("disabled")).toBeDefined();
    expect(check).not.toHaveBeenCalled();
    expect(f.studio.integration().workerNodeBin).toBe("node");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(f.studio.integration().workerNodeBin).toBe("C:/Runtime/node.exe");
    await button.trigger("click");
    await flushPromises();
    expect(check).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("pinned background worker are verified");
    expect(f.studio.state().jobs).toEqual([]);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("mirrors observed worker readiness in project Runtime without editing a project or claiming provider readiness", async () => {
  const f = await workflowUiFixture();
  f.store.openSettingsTool("runtime");
  await f.studio.store.updateRuntime({
    durableBuild: {
      ready: false,
      message: "Configure a native Node executable before checking the worker.",
    },
  });
  const wrapper = mount(SettingsView, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const writes = f.storage.saves;
    const section = wrapper.get(
      '[aria-label="Background Build worker readiness"]',
    );
    expect(section.text()).toContain("Configure a native Node executable");
    expect(section.text()).toContain("Vault integrations");
    expect(section.text()).toContain("does not start a Build");
    expect(f.storage.saves).toBe(writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("keeps concurrency drafts independent of saved integration values and saves both bounded lanes explicitly", async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(PluginSettings, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    await wrapper
      .get('[aria-label="Concurrent background Builds"]')
      .setValue("3");
    await wrapper.get('[aria-label="Concurrent short tasks"]').setValue("2");
    expect(
      f.studio.integration().executionConcurrency ?? {
        builds: 1,
        shortTasks: 1,
      },
    ).toEqual({ builds: 1, shortTasks: 1 });
    await f.studio.store.updateRuntime({
      durableBuild: {
        ready: false,
        message: "Readiness changed while editing.",
      },
    });
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Concurrent background Builds"]').element,
    ).toHaveProperty("value", "3");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(f.studio.integration().executionConcurrency).toEqual({
      builds: 3,
      shortTasks: 2,
    });
    expect(wrapper.text()).toContain(
      "Lowering a limit does not cancel active work",
    );
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await f.dispose();
  }
});

it("requires explicit acknowledgment of a repairable unused startup error and never treats failed repair as success", async () => {
  const f = await workflowUiFixture();
  await f.studio.store.updateRuntime({
    durableBuild: {
      ready: false,
      repairable: true,
      message: "A verified unused startup record needs repair.",
    },
  });
  const repair = vi
    .spyOn(f.studio, "repairDurableBuildRuntime")
    .mockImplementation(async () => ({
      ready: false,
      repairable: true,
      message: "The original startup could not be repaired safely.",
    }));
  const wrapper = mount(PluginSettings, {
    global: {
      plugins: [f.pinia, f.provider],
      directives: { "cf-icon": () => {} },
    },
  });
  try {
    await flushPromises();
    const writes = f.storage.saves;
    const button = () =>
      wrapper
        .findAll("button")
        .find((item) => item.text() === "Repair unused worker startup")!;
    expect(button().attributes("disabled")).toBeDefined();
    await wrapper
      .get('[aria-label="I reviewed the worker startup error"]')
      .setValue(true);
    await f.studio.store.updateRuntime({
      durableBuild: {
        ready: false,
        repairable: true,
        message: "The startup evidence changed; review this error again.",
      },
    });
    await flushPromises();
    expect(button().attributes("disabled")).toBeDefined();
    await wrapper
      .get('[aria-label="I reviewed the worker startup error"]')
      .setValue(true);
    await button().trigger("click");
    await flushPromises();
    expect(repair).toHaveBeenCalledWith(true);
    expect(wrapper.text()).toContain("could not be repaired safely");
    expect(f.store.toasts.at(-1)?.error).toBe(true);
    expect(f.storage.saves).toBe(writes);
    expect(f.studio.state().jobs).toEqual([]);
    expect(f.runner).not.toHaveBeenCalled();
  } finally {
    repair.mockRestore();
    wrapper.unmount();
    await f.dispose();
  }
});
