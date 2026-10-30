// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ChatComposer from "../../../presentation/components/coforge/ChatComposer.vue";
import { workflowUiFixture } from "./workflow-ui-fixture";

it.each([false, true])(
  "preserves a newer draft when a previous send completes (changed viewer: %s)",
  async (changeViewer) => {
    const fixture = await workflowUiFixture();
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const send = vi
      .spyOn(fixture.studio, "sendChat")
      .mockImplementation(async () => {
        await held;
        return { ok: true, message: "Accepted" };
      });
    const wrapper = mount(ChatComposer, {
      global: {
        plugins: [fixture.pinia, fixture.provider],
        directives: { "cf-icon": () => {} },
      },
    });
    try {
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Test commands locally")!
        .trigger("click");
      const identity = wrapper.get('input[aria-label="Simulated viewer name"]');
      const message = wrapper.get('textarea[aria-label="Chat message"]');
      await identity.setValue("First viewer");
      await message.setValue("!request CFP-001 A lantern");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(send).toHaveBeenCalledWith(
        "First viewer",
        "!request CFP-001 A lantern",
      );
      if (changeViewer) await identity.setValue("Second viewer");
      await message.setValue("!register");
      finish?.();
      await flushPromises();
      expect(message.element).toHaveProperty("value", "!register");
      expect(
        wrapper
          .get('button[aria-label="Send chat message"]')
          .attributes("disabled"),
      ).toBeUndefined();
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(send).toHaveBeenLastCalledWith(
        changeViewer ? "Second viewer" : "First viewer",
        "!register",
      );
      expect(message.element).toHaveProperty("value", "");
    } finally {
      finish?.();
      wrapper.unmount();
      await fixture.dispose();
    }
  },
);
