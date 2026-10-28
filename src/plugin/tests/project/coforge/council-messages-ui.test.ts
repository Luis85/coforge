// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { expect, it } from "vitest";
import CouncilMessages from "../../../presentation/components/coforge/CouncilMessages.vue";
import type { CouncilMessagingActions } from "../../../presentation/composables/coforge/use-council-messages";

it("posts information explicitly and preserves its draft after a failed write", async () => {
  let fail = true;
  const posted: string[] = [];
  const actions: CouncilMessagingActions = {
    messages: () => [],
    subscribe: () => () => undefined,
    postInformation: async (_team, body) => {
      if (fail) throw new Error("Storage is unavailable.");
      posted.push(body);
    },
    flushMessages: async () => undefined,
    stopConversation: async () => undefined,
  };
  const wrapper = mount(CouncilMessages, {
    props: { actions, teamId: "team" },
    global: { plugins: [createPinia()] },
  });
  await wrapper.get("textarea").setValue("Consider keyboard access.");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.get("textarea").element.value).toBe(
    "Consider keyboard access.",
  );
  expect(wrapper.get('[role="alert"]').text()).toContain("Storage");
  fail = false;
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(posted).toEqual(["Consider keyboard access."]);
  expect(wrapper.get("textarea").element.value).toBe("");
  expect(wrapper.text()).toContain("starts no tasks");
  wrapper.unmount();
});
