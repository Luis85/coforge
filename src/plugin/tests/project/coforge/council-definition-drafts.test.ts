// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import CouncilDefinitions from "../../../presentation/components/coforge/CouncilDefinitions.vue";
import {
  CouncilCatalogue,
  type CouncilCatalogueSnapshot,
} from "../../../features/coforge/application/council-catalogue";
import {
  definitionRevision,
  type CouncilDefinitionDocument,
} from "../../../features/coforge/domain/council-definitions";

it("restores unsaved definition drafts through selection, creation, duplication and project changes, with explicit discard", async () => {
  const definitions: CouncilDefinitionDocument[] = [
    {
      schema: "agent/v1",
      id: "agent-one",
      name: "Shared agent",
      enabled: true,
      role: "Review",
      instructions: "Review the proposal.",
      provider: "demo",
      model: "sonnet",
      contextSources: [],
      requestedCapabilities: { project: "none", messaging: false },
    },
    ...["A", "B"].map((letter) => ({
      schema: "team/v1" as const,
      id: `team-${letter}`,
      name: `Team ${letter}`,
      enabled: true,
      projectId: letter,
      members: ["agent-one"],
      pinnedContext: [],
      recentMessages: 10,
      allowedRecipients: [],
    })),
  ];
  const snapshot: CouncilCatalogueSnapshot = {
    valid: definitions.map((definition) => ({
      path: `${definition.id}.md`,
      definition,
      revision: definitionRevision(definition),
    })),
    invalid: [],
  };
  const catalogue = new CouncilCatalogue({
    scan: async () => structuredClone(snapshot),
    open: async () => undefined,
    save: async (definition) => {
      snapshot.valid = [
        ...snapshot.valid.filter(
          (entry) => entry.definition.id !== definition.id,
        ),
        {
          definition,
          path: `${definition.id}.md`,
          revision: definitionRevision(definition),
        },
      ];
    },
  });
  const wrapper = mount(CouncilDefinitions, {
    props: { catalogue, projectId: "A" },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  const click = async (name: string) => {
    await wrapper
      .findAll("button")
      .find((button) => button.text().startsWith(name))!
      .trigger("click");
    await flushPromises();
  };
  const name = () => {
    const input = wrapper.get('input[aria-label="Definition name"]').element;
    if (!(input instanceof HTMLInputElement))
      throw new Error("Expected definition name.");
    return input.value;
  };
  await click("Team A");
  await wrapper.get('input[aria-label="Definition name"]').setValue("Dirty A");
  expect(wrapper.text()).toContain("Unsaved changes");
  await click("Create team");
  await wrapper
    .get('input[aria-label="Definition name"]')
    .setValue("New unsaved team A");
  await click("Team A");
  expect(name()).toBe("Dirty A");
  await click("Duplicate definition");
  await click("Team A");
  expect(name()).toBe("Dirty A");
  const archive = wrapper
    .findAll("button")
    .find((button) => button.text() === "Archive definition")!;
  expect(archive.attributes("disabled")).toBeDefined();
  await wrapper.setProps({ projectId: "B" });
  await flushPromises();
  expect(wrapper.find('input[aria-label="Definition name"]').exists()).toBe(
    false,
  );
  await click("Team B");
  await wrapper.get('input[aria-label="Definition name"]').setValue("Dirty B");
  await wrapper.setProps({ projectId: "A" });
  await flushPromises();
  expect(name()).toBe("Dirty A");
  await click("Discard draft");
  expect(name()).toBe("Team A");
  await click("New unsaved team A");
  expect(name()).toBe("New unsaved team A");
  await wrapper.setProps({ projectId: "B" });
  await flushPromises();
  expect(name()).toBe("Dirty B");
  wrapper.unmount();
});
it("refreshes clean canonical drafts after external edits while preserving genuinely unsaved changes", async () => {
  let definition: CouncilDefinitionDocument = {
    schema: "agent/v1",
    id: "external-agent",
    name: "External reviewer",
    enabled: true,
    role: "Review",
    instructions: "Original instructions.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  };
  const catalogue = new CouncilCatalogue({
    scan: async () => ({
      valid: [
        {
          definition: structuredClone(definition),
          path: "Private/Moved.md",
          revision: definitionRevision(definition),
        },
      ],
      invalid: [],
    }),
    save: async () => undefined,
    open: async () => undefined,
  });
  const wrapper = mount(CouncilDefinitions, {
    props: { catalogue, projectId: "A" },
    global: { plugins: [createPinia()] },
  });
  const click = async (name: string) => {
    await wrapper
      .findAll("button")
      .find((button) => button.text().startsWith(name))!
      .trigger("click");
    await flushPromises();
  };
  const instructions = () => {
    const element = wrapper.get(
      'textarea[aria-label="CoWorker instructions"]',
    ).element;
    if (!(element instanceof HTMLTextAreaElement))
      throw new Error("Expected instructions.");
    return element.value;
  };
  await flushPromises();
  await click("External reviewer");
  definition = {
    ...definition,
    instructions: "External canonical instructions.",
  };
  await click("Refresh definitions");
  expect(instructions()).toBe("External canonical instructions.");
  await click("Create CoWorker");
  definition = { ...definition, instructions: "Newer canonical instructions." };
  await click("Refresh definitions");
  await click("External reviewer");
  expect(instructions()).toBe("Newer canonical instructions.");
  await wrapper
    .get('textarea[aria-label="CoWorker instructions"]')
    .setValue("Unsaved local instructions.");
  definition = {
    ...definition,
    instructions: "Latest canonical instructions.",
  };
  await click("Refresh definitions");
  expect(instructions()).toBe("Unsaved local instructions.");
  await click("Create CoWorker");
  await click("External reviewer");
  expect(instructions()).toBe("Unsaved local instructions.");
  await click("Discard draft");
  expect(instructions()).toBe("Latest canonical instructions.");
  wrapper.unmount();
});
it("explains Herdr unavailability while preserving an imported Herdr provider selection", async () => {
  const definition: CouncilDefinitionDocument = {
    schema: "agent/v1",
    id: "herdr-agent",
    name: "Existing Herdr agent",
    enabled: true,
    role: "Review",
    instructions: "Review this.",
    provider: "herdr",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  };
  const catalogue = new CouncilCatalogue({
    scan: async () => ({
      valid: [
        {
          definition,
          path: "Agent.md",
          revision: definitionRevision(definition),
        },
      ],
      invalid: [],
    }),
    save: async () => undefined,
    open: async () => undefined,
  });
  const wrapper = mount(CouncilDefinitions, {
    props: { catalogue, projectId: "A" },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((button) => button.text().startsWith("Existing Herdr agent"))!
    .trigger("click");
  const select = wrapper
    .findAll("select")
    .find((field) => field.find('option[value="herdr"]').exists())!;
  expect(
    select.get('option[value="herdr"]').attributes("disabled"),
  ).toBeDefined();
  if (!(select.element instanceof HTMLSelectElement))
    throw new Error("Expected provider selector.");
  expect(select.element.value).toBe("herdr");
  expect(wrapper.text()).toContain(
    "Herdr cannot enforce the isolated invocation profile",
  );
  wrapper.unmount();
});
