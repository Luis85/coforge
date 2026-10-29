// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import WorkflowV2Editor from "../../../presentation/components/coforge/WorkflowV2Editor.vue";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import type { WorkflowV2Actions } from "../../../features/coforge/application/workflow-v2-ports";
import type { WorkflowV2Definition } from "../../../features/coforge/domain/configured-workflow-v2";
import { compileWorkflowV2 } from "../../../features/coforge/application/workflow-v2-compiler";
import { workflowV2Admission } from "../../../features/coforge/application/workflow-v2-execution";
import { reviewedWorkflowIdentity } from "../../../features/coforge/application/reviewed-preflight";

it("explicitly creates and saves a v2 draft without changing legacy workflows and preserves errors", async () => {
  let definition: WorkflowV2Definition | null = null;
  let fail = false;
  const actions: WorkflowV2Actions = {
    load: async () => ({ definition, revision: definition ? "saved-one" : "" }),
    save: async (_project, value) => {
      if (fail) throw new Error("External edit. Refresh before saving.");
      definition = structuredClone(value);
      return { definition, revision: "saved-one" };
    },
    preflight: async () => {
      throw new Error("Preflight was not requested.");
    },
    start: async () => {
      throw new Error("No run was requested.");
    },
  };
  const catalogue = new CouncilCatalogue({
    scan: async () => ({ valid: [], invalid: [] }),
    save: async () => undefined,
    open: async () => undefined,
  });
  const wrapper = mount(WorkflowV2Editor, {
    props: { actions, catalogue, projectId: "CFP-001" },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  expect(definition).toBeNull();
  await wrapper
    .get('button[aria-label="Create proposal workflow"]')
    .trigger("click");
  const stepControls = wrapper.findAll(".cf-proposal-step-tools button");
  expect(stepControls).toHaveLength(4);
  for (const button of stepControls)
    expect(button.attributes("aria-label").toLowerCase()).toContain(
      button.text().trim().toLowerCase(),
    );
  await wrapper
    .get('input[aria-label="Proposal workflow name"]')
    .setValue("Human review process");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(definition).toMatchObject({
    format: "coforge-workflow/v2",
    name: "Human review process",
    steps: [{ kind: "approval" }],
  });
  fail = true;
  await wrapper
    .get('input[aria-label="Proposal workflow name"]')
    .setValue("Keep this draft");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain("External edit");
  const input = wrapper.get(
    'input[aria-label="Proposal workflow name"]',
  ).element;
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected text input.");
  expect(input.value).toBe("Keep this draft");
  fail = false;
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Add proposal step")!
    .trigger("click");
  const kind = wrapper
    .findAll("select")
    .filter((select) => select.find('option[value="message"]').exists())
    .at(-1)!;
  await kind.setValue("message");
  await wrapper.get('input[maxlength="80"]').setValue("agent-reviewer");
  await wrapper
    .get('textarea[aria-label="Message body"]')
    .setValue("Review the captured proposal: {{source}}");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(definition).toMatchObject({
    steps: [
      { kind: "approval" },
      {
        kind: "message",
        purpose: "information",
        recipientId: "agent-reviewer",
        body: "Review the captured proposal: {{source}}",
      },
    ],
  });
  wrapper.unmount();
});
it("does not apply a late workflow load after another project is selected", async () => {
  const definition = (name: string): WorkflowV2Definition => ({
    format: "coforge-workflow/v2",
    revision: "v2-one",
    name,
    subjectMode: "note",
    teamId: "team-one",
    limits: {
      timeoutSeconds: 180,
      maxTurns: 12,
      maxBudgetUsd: 1,
      maxInvocations: 24,
    },
    collections: [],
    steps: [
      { id: "review", name: "Review", kind: "approval", instructions: "" },
    ],
  });
  let resolveOld: (() => void) | undefined;
  const old = new Promise<void>((resolve) => {
    resolveOld = resolve;
  });
  const actions: WorkflowV2Actions = {
    load: async (projectId) => {
      if (projectId === "old") await old;
      return { definition: definition(projectId), revision: projectId };
    },
    save: async () => {
      throw new Error("No save requested.");
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
    props: { actions, catalogue, projectId: "old" },
    global: { plugins: [createPinia()] },
  });
  await wrapper.setProps({ projectId: "new" });
  await flushPromises();
  resolveOld?.();
  await flushPromises();
  const input = wrapper.get(
    'input[aria-label="Proposal workflow name"]',
  ).element;
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected workflow name input.");
  expect(input.value).toBe("new");
  wrapper.unmount();
});
it("retains unsaved proposal workflows and source drafts per project until explicitly discarded", async () => {
  const definition = (name: string): WorkflowV2Definition => ({
    format: "coforge-workflow/v2",
    revision: `revision-${name}`,
    name,
    subjectMode: "note",
    teamId: "team-one",
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
  const actions: WorkflowV2Actions = {
    load: async (project) => ({
      definition: definition(project),
      revision: project,
    }),
    save: async () => {
      throw new Error("No save requested.");
    },
    preflight: async () => {
      throw new Error("No preflight requested.");
    },
    start: async () => {
      throw new Error("No run requested.");
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
  const name = () => {
    const input = wrapper.get(
      'input[aria-label="Proposal workflow name"]',
    ).element;
    if (!(input instanceof HTMLInputElement))
      throw new Error("Expected workflow name.");
    return input.value;
  };
  await wrapper
    .get('input[aria-label="Proposal workflow name"]')
    .setValue("Dirty A");
  await wrapper
    .get('input[placeholder="CoForge/Requests/Proposal.md"]')
    .setValue("Private/A.md");
  await wrapper.setProps({ projectId: "B" });
  await flushPromises();
  expect(name()).toBe("B");
  await wrapper
    .get('input[aria-label="Proposal workflow name"]')
    .setValue("Dirty B");
  await wrapper.setProps({ projectId: "A" });
  await flushPromises();
  expect(name()).toBe("Dirty A");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Reload saved proposal workflow")!
    .trigger("click");
  await flushPromises();
  expect(name()).toBe("Dirty A");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Discard proposal draft")!
    .trigger("click");
  await flushPromises();
  expect(name()).toBe("A");
  await wrapper.setProps({ projectId: "B" });
  await flushPromises();
  expect(name()).toBe("Dirty B");
  wrapper.unmount();
});
it("submits the exact displayed preflight identity and invalidates the preview when the source changes", async () => {
  const definition: WorkflowV2Definition = {
    format: "coforge-workflow/v2",
    revision: "one",
    name: "Review",
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
  };
  const source = {
    sourceId: "unassigned",
    revision: "source-one",
    generation: 0,
    markdown: "Review this proposal.",
  };
  const plan = compileWorkflowV2(
    definition,
    {
      kind: "note",
      sourceId: source.sourceId,
      revision: source.revision,
      markdown: source.markdown,
    },
    {
      projectId: "A",
      team: {
        schema: "team/v1",
        id: "team",
        name: "Team",
        enabled: true,
        projectId: "A",
        members: [],
        pinnedContext: [],
        recentMessages: 10,
        allowedRecipients: [],
      },
      agents: [],
      councils: [],
    },
  );
  const preview = {
    plan,
    source,
    context: "Pinned context",
    invocations: 0,
    warnings: [],
  };
  let submitted = "";
  const actions: WorkflowV2Actions = {
    load: async () => ({ definition, revision: "one" }),
    save: async () => ({ definition, revision: "one" }),
    preflight: async () => structuredClone(preview),
    start: async (_project, _source, _simulation, _destination, expected) => {
      submitted = expected ?? "";
      const now = "2026-10-28T12:00:00.000Z";
      return {
        ...workflowV2Admission(preview, "run", "submission", false),
        state: "queued",
        cursor: 0,
        attempts: [],
        artifacts: [],
        createdAt: now,
        updatedAt: now,
      };
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
    .get('input[placeholder="CoForge/Requests/Proposal.md"]')
    .setValue("Private/Proposal.md");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Preflight proposal workflow")!
    .trigger("click");
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Submit proposal workflow")!
    .trigger("click");
  await flushPromises();
  expect(submitted).toBe(reviewedWorkflowIdentity(preview));
  await wrapper
    .get('input[placeholder="CoForge/Requests/Proposal.md"]')
    .setValue("Private/Another.md");
  expect(
    wrapper
      .findAll("button")
      .some((button) => button.text() === "Submit proposal workflow"),
  ).toBe(false);
  wrapper.unmount();
});
