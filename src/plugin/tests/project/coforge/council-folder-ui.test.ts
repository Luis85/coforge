// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import CouncilFolderSettings from "../../../presentation/components/coforge/CouncilFolderSettings.vue";
import {
  DEFAULT_COUNCIL_FOLDERS,
  councilDefinitionFoldersCheck,
  type CouncilDefinitionFolders,
} from "../../../features/coforge/domain/council-definition-folders";

it("requires a current folder preview, preserves failed drafts and saves only explicit private settings", async () => {
  let revision = 3;
  const saves: CouncilDefinitionFolders[] = [];
  const actions = {
    preview: async (folders: CouncilDefinitionFolders) => ({
      folders: councilDefinitionFoldersCheck(folders),
      definitionCount: 3,
      invalid: [],
    }),
    configure: async (folders: CouncilDefinitionFolders, expected: number) => {
      if (expected !== revision)
        throw new Error("Settings changed. Preview again before saving.");
      saves.push(folders);
    },
  };
  const wrapper = mount(CouncilFolderSettings, {
    props: {
      actions,
      folders: DEFAULT_COUNCIL_FOLDERS,
      preferencesRevision: revision,
    },
    global: { plugins: [createPinia()] },
  });
  await wrapper
    .get('input[aria-label="Agent definitions folder"]')
    .setValue("Private/Agents");
  expect(
    wrapper
      .findAll("button")
      .some((button) => button.text() === "Save definition folders"),
  ).toBe(false);
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Preview definition folders")!
    .trigger("click");
  await flushPromises();
  expect(saves).toHaveLength(0);
  revision = 4;
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain("Settings changed");
  const input = wrapper.get(
    'input[aria-label="Agent definitions folder"]',
  ).element;
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected folder input.");
  expect(input.value).toBe("Private/Agents");
  await wrapper.setProps({ preferencesRevision: revision });
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Preview definition folders")!
    .trigger("click");
  await flushPromises();
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(saves).toEqual([
    { ...DEFAULT_COUNCIL_FOLDERS, agents: "Private/Agents" },
  ]);
  wrapper.unmount();
});
