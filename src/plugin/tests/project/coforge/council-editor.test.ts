// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import CouncilDefinitions from "../../../presentation/components/coforge/CouncilDefinitions.vue";
import {
  CouncilCatalogue,
  type CouncilCatalogueSnapshot,
} from "../../../features/coforge/application/council-catalogue";
import { definitionRevision } from "../../../features/coforge/domain/council-definitions";

it("creates an agent through labelled controls and keeps a failed save draft", async () => {
  let snapshot: CouncilCatalogueSnapshot = { valid: [], invalid: [] };
  let fail = false;
  const catalogue = new CouncilCatalogue({
    scan: async () => structuredClone(snapshot),
    open: async () => undefined,
    save: async (definition) => {
      if (fail) throw new Error("Storage unavailable. Retry saving.");
      snapshot = {
        ...snapshot,
        valid: [
          ...snapshot.valid.filter(
            (item) => item.definition.id !== definition.id,
          ),
          {
            definition: structuredClone(definition),
            path: `${definition.id}.md`,
            revision: definitionRevision(definition),
          },
        ],
      };
    },
  });
  const wrapper = mount(CouncilDefinitions, {
    props: { catalogue, projectId: "CFP-001" },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Create agent")!
    .trigger("click");
  await wrapper
    .get('input[aria-label="Definition name"]')
    .setValue("Architecture reviewer");
  await wrapper
    .get('textarea[aria-label="Agent instructions"]')
    .setValue("Find missing boundaries.");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(
    snapshot.valid.find((item) => item.definition.schema === "agent/v1")!
      .definition,
  ).toMatchObject({
    name: "Architecture reviewer",
    instructions: "Find missing boundaries.",
  });
  fail = true;
  await wrapper
    .get('input[aria-label="Definition name"]')
    .setValue("Unsaved edit");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain("Storage unavailable");
  const input = wrapper.get('input[aria-label="Definition name"]').element;
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected a text input.");
  expect(input.value).toBe("Unsaved edit");
  wrapper.unmount();
});
