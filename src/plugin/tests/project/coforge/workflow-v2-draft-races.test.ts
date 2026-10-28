// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import WorkflowV2Editor from "../../../presentation/components/coforge/WorkflowV2Editor.vue";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import type { WorkflowV2Actions } from "../../../features/coforge/application/workflow-v2-ports";
import type { WorkflowV2Definition } from "../../../features/coforge/domain/configured-workflow-v2";

it("preserves newer local edits when an earlier save returns after switching away and back", async () => {
  const definition = (name: string): WorkflowV2Definition => ({
    format: "coforge-workflow/v2",
    revision: `revision-${name}`,
    name,
    subjectMode: "note",
    teamId: "team",
    limits: {
      timeoutSeconds: 180,
      maxTurns: 12,
      maxBudgetUsd: 1,
      maxInvocations: 24,
    },
    collections: [],
    steps: [
      { id: "review", kind: "approval", name: "Review", instructions: "" },
    ],
  });
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const actions: WorkflowV2Actions = {
    load: async (project) => ({
      definition: definition(project),
      revision: project,
    }),
    save: async (_project, submitted) => {
      await pending;
      return { definition: submitted, revision: "new-server-revision" };
    },
    preflight: async () => {
      throw new Error("No preflight requested.");
    },
    start: async () => {
      throw new Error("No start requested.");
    },
  };
  const catalogue = new CouncilCatalogue({
    scan: async () => ({ valid: [], invalid: [] }),
    save: async () => undefined,
    open: async () => undefined,
  });
  const wrapper = mount(WorkflowV2Editor, {
    props: { actions, catalogue, projectId: "A" },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  await wrapper
    .get('input[aria-label="Proposal workflow name"]')
    .setValue("Submitted edit A");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  await wrapper.setProps({ projectId: "B" });
  await flushPromises();
  await wrapper.setProps({ projectId: "A" });
  await flushPromises();
  await wrapper
    .get('input[aria-label="Proposal workflow name"]')
    .setValue("Newer unsaved edit A");
  release?.();
  await flushPromises();
  const name = wrapper.get(
    'input[aria-label="Proposal workflow name"]',
  ).element;
  if (!(name instanceof HTMLInputElement))
    throw new Error("Expected workflow name field.");
  expect(name.value).toBe("Newer unsaved edit A");
  expect(wrapper.text()).toContain("Unsaved changes");
  wrapper.unmount();
});
