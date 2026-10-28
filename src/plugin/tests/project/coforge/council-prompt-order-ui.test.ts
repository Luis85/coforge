// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { expect, it } from "vitest";
import CouncilDefinitions from "../../../presentation/components/coforge/CouncilDefinitions.vue";
import CouncilRoundSchedule from "../../../presentation/components/coforge/CouncilRoundSchedule.vue";
import {
  CouncilCatalogue,
  type CouncilCatalogueSnapshot,
} from "../../../features/coforge/application/council-catalogue";
import { definitionRevision } from "../../../features/coforge/domain/council-definitions";
import {
  promptOrderAgents,
  promptOrderDefinition,
  promptOrderPreview,
  promptOrderTeam,
} from "./council-prompt-order-fixture";

it("edits per-round prompt order, preserves it in duplicates and retains the draft after a failed save", async () => {
  let snapshot: CouncilCatalogueSnapshot = {
    valid: [...promptOrderAgents, promptOrderTeam, promptOrderDefinition()].map(
      (definition) => ({
        definition,
        path: `${definition.id}.md`,
        revision: definitionRevision(definition),
      }),
    ),
    invalid: [],
  };
  let fail = false;
  const catalogue = new CouncilCatalogue({
    scan: async () => structuredClone(snapshot),
    open: async () => {},
    save: async (definition) => {
      if (fail) throw new Error("Storage unavailable. Retry saving.");
      snapshot = {
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
        invalid: [],
      };
    },
  });
  const pinia = createPinia();
  const wrapper = mount(CouncilDefinitions, {
    props: { catalogue, projectId: promptOrderTeam.projectId },
    global: { plugins: [pinia] },
  });
  try {
    await flushPromises();
    const select = wrapper
      .findAll(".cf-council-definition-list button")
      .find((button) => button.text().includes("Design council"));
    if (!select) throw new Error("Missing Council definition");
    await select.trigger("click");
    const opinions = wrapper.get<HTMLSelectElement>(
      '[aria-label="Prompt order for Opinions"]',
    );
    expect(opinions.element.value).toBe("round-robin");
    await opinions.setValue("fan-out");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const saved = snapshot.valid.find(
      (item) => item.definition.id === "advice",
    )?.definition;
    expect(saved?.schema === "council/v1" && saved.rounds[0]?.promptOrder).toBe(
      "fan-out",
    );
    const duplicate = wrapper
      .findAll("button")
      .find((button) => button.text() === "Duplicate round");
    if (!duplicate) throw new Error("Missing duplicate action");
    await duplicate.trigger("click");
    expect(
      wrapper.get<HTMLSelectElement>(
        '[aria-label="Prompt order for Opinions copy"]',
      ).element.value,
    ).toBe("fan-out");
    await wrapper
      .get('[aria-label="Prompt order for Solutions"]')
      .setValue("fan-out");
    fail = true;
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Storage unavailable",
    );
    expect(
      wrapper.get<HTMLSelectElement>(
        '[aria-label="Prompt order for Solutions"]',
      ).element.value,
    ).toBe("fan-out");
  } finally {
    wrapper.unmount();
    disposePinia(pinia);
  }
});

it("shows captured fan-out and legacy sequential rounds in preflight metadata", () => {
  const definition = promptOrderDefinition();
  definition.rounds[0]!.promptOrder = "fan-out";
  const preview = promptOrderPreview(definition);
  const wrapper = mount(CouncilRoundSchedule, {
    props: { rounds: preview.plan.definition.rounds },
  });
  try {
    definition.rounds[0]!.promptOrder = "round-robin";
    expect(wrapper.text()).toContain(
      "Opinions · Fan out (concurrent) · 2 members",
    );
    expect(wrapper.text()).toContain(
      "Solutions · Round robin (sequential) · 2 members",
    );
    expect(wrapper.text()).toContain("preceding round's persisted outcomes");
  } finally {
    wrapper.unmount();
  }
});
