// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import CouncilDefinitionDependencies from "../../../presentation/components/coforge/CouncilDefinitionDependencies.vue";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import type { CouncilDependencySnapshot } from "../../../features/coforge/application/council-catalogue";

it("names workflow and inbox usage and ignores an obsolete lookup after another definition is selected", async () => {
  let resolveOld: ((usage: CouncilDependencySnapshot) => void) | undefined;
  const old = new Promise<CouncilDependencySnapshot>((resolve) => {
    resolveOld = resolve;
  });
  const catalogue = Object.assign(
    new CouncilCatalogue({
      scan: async () => ({ valid: [], invalid: [] }),
      save: async () => undefined,
      open: async () => undefined,
    }),
    {
      dependencies: async (id: string) =>
        id === "old"
          ? old
          : {
              items: [
                {
                  kind: "workflow" as const,
                  id: "workflow-one",
                  name: "Review workflow",
                  enabled: true,
                },
                {
                  kind: "inbox" as const,
                  id: "inbox-one",
                  name: "Proposal intake",
                  enabled: false,
                },
              ],
              complete: true,
            },
    },
  );
  const wrapper = mount(CouncilDefinitionDependencies, {
    props: { catalogue, definitionId: "old" },
    global: { plugins: [createPinia()] },
  });
  await wrapper.setProps({ definitionId: "new" });
  await flushPromises();
  expect(wrapper.text()).toContain("Review workflow");
  expect(wrapper.text()).toContain("Proposal intake");
  resolveOld?.({
    items: [
      { kind: "team", id: "old-team", name: "Obsolete team", enabled: true },
    ],
    complete: true,
  });
  await flushPromises();
  expect(wrapper.text()).not.toContain("Obsolete team");
  expect(wrapper.text()).toContain("Disabled");
  wrapper.unmount();
});
