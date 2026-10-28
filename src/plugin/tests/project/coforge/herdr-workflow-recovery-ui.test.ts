// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import type {
  HerdrWorkflowActions,
  HerdrWorkflowState,
} from "../../../features/coforge/application/herdr-workflow-ports";
import HerdrWorkflowRecovery from "../../../presentation/components/coforge/HerdrWorkflowRecovery.vue";
const binding: { service?: HerdrWorkflowActions } = {};
vi.mock("../../../presentation/context/coforge-context", () => ({
  useCoforge: () => ({ host: { herdrWorkflows: binding.service } }),
}));
it("requires successful fresh inspection and an explicit confirmation before acknowledging a held attempt", async () => {
  const state: HerdrWorkflowState = {
    ready: true,
    busy: false,
    error: "",
    records: [
      {
        id: "attempt",
        jobId: "job",
        ideaId: "CF-123",
        projectId: "CFP-001",
        stage: "screen",
        model: "sonnet",
        kind: "claude",
        settings: { executable: "herdr", session: "default" },
        fingerprint: "fingerprint",
        nonce: "nonce",
        at: "2026-10-28T10:00:00Z",
        phase: "attention",
      },
    ],
  };
  let listener = (_state: HerdrWorkflowState) => {};
  const stop = vi.fn();
  const inspect = vi
    .fn<HerdrWorkflowActions["inspect"]>()
    .mockRejectedValueOnce(new Error("Original target cannot be confirmed."))
    .mockImplementation(async () => {
      state.records[0]!.inspection = "target-changed";
      listener(structuredClone(state));
    });
  const acknowledge = vi
    .fn(async () => {
      state.records[0]!.phase = "reviewed";
      listener(structuredClone(state));
    })
    .mockRejectedValueOnce(new Error("Original agent changed; inspect again."));
  binding.service = {
    snapshot: () => structuredClone(state),
    subscribe: (callback) => {
      listener = callback;
      return stop;
    },
    inspect,
    acknowledge,
  };
  const wrapper = mount(HerdrWorkflowRecovery);
  const checkbox = wrapper.get("input[type=checkbox]");
  const acknowledgment = wrapper.get("button:last-of-type");
  expect(checkbox.attributes("disabled")).toBeDefined();
  expect(acknowledgment.attributes("disabled")).toBeDefined();
  await wrapper.get("button").trigger("click");
  await flushPromises();
  expect(wrapper.get("[role=alert]").text()).toContain("cannot be confirmed");
  expect(checkbox.attributes("disabled")).toBeDefined();
  await wrapper.get("button").trigger("click");
  await flushPromises();
  expect(checkbox.attributes("disabled")).toBeUndefined();
  expect(wrapper.get('[role="status"]').text()).toContain(
    "original agent has changed or is no longer present",
  );
  expect(wrapper.get("label").text()).toContain(
    "in the original session and inspected its changes",
  );
  expect(acknowledgment.attributes("disabled")).toBeDefined();
  await checkbox.setValue(true);
  await acknowledgment.trigger("click");
  await flushPromises();
  expect(acknowledge).toHaveBeenCalledExactlyOnceWith("attempt");
  expect(wrapper.get("[role=alert]").text()).toContain("inspect again");
  expect(checkbox.attributes("disabled")).toBeDefined();
  expect(acknowledgment.attributes("disabled")).toBeDefined();
  await wrapper.get("button").trigger("click");
  await flushPromises();
  await checkbox.setValue(true);
  await acknowledgment.trigger("click");
  await flushPromises();
  expect(acknowledge).toHaveBeenCalledTimes(2);
  expect(wrapper.text()).toBe("");
  wrapper.unmount();
  expect(stop).toHaveBeenCalledOnce();
  binding.service = undefined;
});
