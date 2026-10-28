// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it } from "vitest";
import BroadcastView from "../../../presentation/components/coforge/BroadcastView.vue";
import WorkflowView from "../../../presentation/components/coforge/WorkflowView.vue";
import StreamPage from "../../../presentation/components/coforge/StreamPage.vue";
import StudioApp from "../../../presentation/components/coforge/StudioApp.vue";
import { disconnectedTwitch } from "../../../features/coforge/domain/twitch";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("separates broadcast goals and retains an OBS draft across focused subpages without starting work", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(BroadcastView, {
    attachTo: document.body,
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => undefined },
    },
  });
  try {
    await flushPromises();
    const navigation = wrapper.get('nav[aria-label="Stream studio pages"]');
    const visit = async (name: string) => {
      const button = navigation
        .findAll("button")
        .find((item) => item.text() === name);
      if (!button) throw new Error(`Missing subpage ${name}`);
      await button.trigger("click");
      await flushPromises();
      expect(button.attributes("aria-current")).toBe("page");
    };
    expect(wrapper.get('[aria-label="Broadcast controls"]').isVisible()).toBe(
      true,
    );
    expect(
      wrapper.get('[aria-label="OBS connection and scenes"]').isVisible(),
    ).toBe(false);
    await visit("Setup");
    const endpoint = wrapper.get('input[placeholder="ws://127.0.0.1:4455/"]');
    await endpoint.setValue("ws://localhost:5555/");
    expect(wrapper.get('[aria-label="Broadcast controls"]').isVisible()).toBe(
      false,
    );
    await visit("Scenes");
    expect(wrapper.get(".cf-obs-scene-manager").isVisible()).toBe(true);
    await visit("Music");
    expect(wrapper.get(".cf-music").isVisible()).toBe(true);
    await visit("Public displays");
    expect(wrapper.get(".cf-stream-displays").isVisible()).toBe(true);
    await visit("History");
    expect(wrapper.get('[aria-label="Stream JSON history"]').isVisible()).toBe(
      true,
    );
    await visit("Setup");
    expect(endpoint.element).toHaveProperty("value", "ws://localhost:5555/");
    expect(fixture.studio.state().obsSettings?.endpoint).not.toBe(
      "ws://localhost:5555/",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
    fixture.store.streamTool = "messages";
    const chat = wrapper
      .findAll("button")
      .find((button) => button.text() === "Open stream chat");
    if (!chat) throw new Error("Stream chat shortcut is missing.");
    await chat.trigger("click");
    expect(fixture.store.view).toBe("stream");
    expect(fixture.store.streamTool).toBe("channel");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("routes task-specific workflow links to runs and preserves the selected page when dirty configuration blocks navigation", async () => {
  const fixture = await workflowUiFixture();
  try {
    fixture.store.workflowTool = "herdr";
    fixture.store.openWorkflowTool("runs");
    expect(fixture.store.view).toBe("workflow");
    expect(fixture.store.workflowTool).toBe("runs");
    fixture.store.workflowTool = "herdr";
    fixture.store.view = "workflow-settings";
    fixture.store.dirtyWorkflow = true;
    fixture.store.openWorkflowTool("runs");
    expect(fixture.store.view).toBe("workflow-settings");
    expect(fixture.store.workflowTool).toBe("herdr");
    fixture.store.streamTool = "messages";
    fixture.store.openStreamTool("connection");
    expect(fixture.store.view).toBe("workflow-settings");
    expect(fixture.store.streamTool).toBe("messages");
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    await fixture.dispose();
  }
});

it("separates request execution from Herdr workspace administration without dispatching work", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(WorkflowView, {
    attachTo: document.body,
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => undefined },
    },
  });
  try {
    await flushPromises();
    const navigation = wrapper.get('nav[aria-label="Agent workflow pages"]');
    expect(
      wrapper.get('[aria-label="Request workflow runs"]').isVisible(),
    ).toBe(true);
    expect(wrapper.get(".cf-herdr").isVisible()).toBe(false);
    const herdr = navigation
      .findAll("button")
      .find((button) => button.text() === "Herdr workspaces");
    if (!herdr) throw new Error("Herdr workspace navigation is missing.");
    await herdr.trigger("click");
    expect(wrapper.get(".cf-herdr").isVisible()).toBe(true);
    expect(
      wrapper.get('[aria-label="Request workflow runs"]').isVisible(),
    ).toBe(false);
    expect(fixture.runner).not.toHaveBeenCalled();
    expect(fixture.studio.state().jobs).toHaveLength(0);
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it("keeps chat focused and routes its Configure Twitch shortcut to the separate settings page", async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(StreamPage, {
    attachTo: document.body,
    global: {
      plugins: [fixture.pinia, fixture.provider],
      directives: { "cf-icon": () => undefined },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.get(".cf-chat-panel").isVisible()).toBe(true);
    expect(
      wrapper.get('[aria-label="Twitch channel controls"]').isVisible(),
    ).toBe(false);
    const configure = wrapper
      .findAll("button")
      .find((button) => button.text() === "Configure Twitch");
    if (!configure) throw new Error("Chat configuration shortcut is missing.");
    await configure.trigger("click");
    expect(
      wrapper.get('[aria-label="Twitch channel controls"]').isVisible(),
    ).toBe(true);
    expect(wrapper.get(".cf-chat-panel").isVisible()).toBe(false);
    const clientId = wrapper.get('input[maxlength="100"]');
    await clientId.setValue("draft-client-id");
    const navigation = wrapper.get('nav[aria-label="Stream tools"]');
    const chat = navigation
      .findAll("button")
      .find((button) => button.text() === "Chat");
    if (!chat) throw new Error("Chat subpage is missing.");
    await chat.trigger("click");
    await configure.trigger("click");
    expect(clientId.element).toHaveProperty("value", "draft-client-id");
    expect(fixture.studio.integration().twitchClientId).not.toBe(
      "draft-client-id",
    );
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});

it.each(["connection", "messages"] as const)(
  "opens contextual moderation from the board after the %s subpage was selected",
  async (previousPage) => {
    const fixture = await workflowUiFixture();
    await fixture.studio.store.transaction((state) => {
      state.runtime.twitch = {
        ...disconnectedTwitch(),
        phase: "connected",
        canModerate: true,
        channel: {
          id: "channel",
          login: "streamer",
          name: "Streamer",
          title: "Game",
          categoryId: "1",
          categoryName: "Development",
        },
      };
      state.chat = [
        {
          id: "chat",
          userId: "twitch:viewer",
          username: "Viewer",
          text: "A message",
          kind: "message",
          source: "twitch",
          externalId: "message-123",
          twitchChannelId: "channel",
          createdAt: "2026-10-28T12:00:00Z",
        },
      ];
    });
    fixture.store.view = "board";
    fixture.store.streamTool = previousPage;
    const wrapper = mount(StudioApp, {
      attachTo: document.body,
      global: {
        plugins: [fixture.pinia, fixture.provider],
        directives: { "cf-icon": () => undefined },
      },
    });
    try {
      await flushPromises();
      await wrapper
        .get('button[aria-label="Review moderation for Viewer"]')
        .trigger("click");
      await flushPromises();
      expect(fixture.store.view).toBe("stream");
      expect(fixture.store.streamTool).toBe("channel");
      expect(wrapper.get(".cf-twitch-moderation").isVisible()).toBe(true);
      expect(wrapper.get('input[maxlength="200"]').element).toHaveProperty(
        "value",
        "message-123",
      );
      expect(fixture.runner).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      await fixture.dispose();
    }
  },
);
