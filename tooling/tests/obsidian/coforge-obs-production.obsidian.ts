import { expect as browserExpect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture";
import { ObsProductionSocketServer } from "./support/obs-production-socket";
import { captureStreamPage } from "./support/obs-stream-visuals";

describe("Focused OBS stream operation in the contained host", () => {
  test("operates stream and scene controls without OBS previews, audio meters or replay on reload", async ({
    obsidian,
  }) => {
    const server = new ObsProductionSocketServer();
    server.state.scenes = [
      { id: "development", name: "Development" },
      { id: "brb", name: "BRB" },
    ];
    server.state.program = "development";
    server.state.preview = "development";
    server.state.inputs = [
      {
        inputUuid: "microphone",
        inputName: "Microphone",
        inputKind: "wasapi_input_capture",
      },
    ];
    await server.start();
    const mutations = () =>
      server.state.requests.filter(
        (request) => !request.type.startsWith("Get"),
      );
    const monitoring = () =>
      server.state.requests.filter(
        (request) => request.type === "GetSourceScreenshot",
      );
    const audioReads = () =>
      server.state.requests.filter((request) =>
        /^GetInput(Mute|Volume|Audio)/.test(request.type),
      ).length;
    try {
      const type = `${obsidian.pluginId}-view-project-workbench`;
      let view = await obsidian.openView(type);
      let pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      expect(
        (await pages.getByRole("button").allTextContents()).map((label) =>
          label.trim(),
        ),
      ).toEqual([
        "Broadcast",
        "Show plan",
        "Setup",
        "Scenes",
        "Music",
        "Public displays",
        "History",
      ]);
      for (const removed of ["Audio", "Sources & layouts"])
        await browserExpect(
          pages.getByRole("button", { name: removed, exact: true }),
        ).toHaveCount(0);
      for (const removed of [
        "Create my studio",
        "Live production desk",
        "OBS audio workspace",
        "OBS source and layout workspace",
      ])
        await browserExpect(
          view.getByRole("region", {
            name: removed,
            exact: true,
            includeHidden: true,
          }),
        ).toHaveCount(0);
      await browserExpect(view.locator("img[alt^='Sampled OBS']")).toHaveCount(
        0,
      );
      await pages.getByRole("button", { name: "Setup", exact: true }).click();
      await view
        .getByRole("button", { name: "Skip setup for now", exact: true })
        .click();
      await view
        .getByLabel("OBS WebSocket URL", { exact: true })
        .fill(server.endpoint);
      await view
        .getByLabel("Connect OBS when CoForge opens", { exact: true })
        .check();
      await view
        .getByRole("button", { name: "Save OBS setup", exact: true })
        .click();
      await browserExpect(
        view.getByText("OBS connection and scenes saved.", { exact: true }),
      ).toBeVisible();
      await pages
        .getByRole("button", { name: "Broadcast", exact: true })
        .click();
      await view
        .getByRole("button", { name: "Connect OBS", exact: true })
        .click();
      await browserExpect(
        view.getByText("OBS connected. Review readiness before going live.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(mutations()).toEqual([]);
      await pages.getByRole("button", { name: "Setup", exact: true }).click();
      await view.getByLabel(/^Go-live scene/).selectOption("development");
      await view.getByLabel(/^BRB scene/).selectOption("brb");
      await view
        .getByRole("button", { name: "Save OBS setup", exact: true })
        .click();
      await browserExpect(
        view.getByText("OBS connection and scenes saved.", { exact: true }),
      ).toBeVisible();
      await pages
        .getByRole("button", { name: "Broadcast", exact: true })
        .click();
      await view
        .getByRole("button", { name: "Prepare stream", exact: true })
        .click();
      await browserExpect(
        view.getByRole("button", { name: "Go live", exact: true }),
      ).toBeEnabled();
      expect(server.state.active).toBe(false);
      const beforeLiveAudio = audioReads();
      await captureStreamPage(
        obsidian,
        view,
        "broadcast",
        ".cf-broadcast-page",
      );
      expect(audioReads()).toBe(beforeLiveAudio);
      expect(server.state.active).toBe(false);
      await view.getByRole("button", { name: "Go live", exact: true }).click();
      await expect.poll(() => server.state.active).toBe(true);
      const liveAccessibility = await new AxeBuilder({ page: obsidian.page })
        .setLegacyMode(true)
        .include(".cf-broadcast-console")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(liveAccessibility.violations).toEqual([]);
      await view
        .getByRole("button", { name: "Pause / BRB", exact: true })
        .click();
      await expect.poll(() => server.state.program).toBe("brb");
      expect(server.state.active).toBe(true);
      await view
        .getByRole("button", { name: "Resume stream", exact: true })
        .click();
      await expect.poll(() => server.state.program).toBe("development");
      await view
        .getByRole("button", { name: "Stop stream", exact: true })
        .click();
      await expect.poll(() => server.state.active).toBe(false);
      expect(audioReads()).toBe(beforeLiveAudio);

      await pages.getByRole("button", { name: "Scenes", exact: true }).click();
      const scenes = view.locator(".cf-obs-scene-manager");
      await scenes
        .getByLabel("New scene name", { exact: true })
        .fill("Workshop");
      await scenes
        .getByRole("button", { name: "Create scene", exact: true })
        .click();
      await expect
        .poll(() =>
          server.state.scenes.some((scene) => scene.name === "Workshop"),
        )
        .toBe(true);
      await scenes
        .getByLabel("Scene to edit", { exact: true })
        .selectOption({ label: "Workshop" });
      await scenes
        .getByLabel("Rename scene name", { exact: true })
        .fill("Community workshop");
      await scenes
        .getByRole("button", { name: "Rename scene", exact: true })
        .click();
      await expect
        .poll(() =>
          server.state.scenes.some(
            (scene) => scene.name === "Community workshop",
          ),
        )
        .toBe(true);
      await scenes
        .getByLabel("Scene copy name", { exact: true })
        .fill("Workshop copy");
      await scenes
        .getByRole("button", { name: "Duplicate scene", exact: true })
        .click();
      await expect
        .poll(() =>
          server.state.scenes.some((scene) => scene.name === "Workshop copy"),
        )
        .toBe(true);
      await scenes
        .getByLabel("Scene to edit", { exact: true })
        .selectOption({ label: "Community workshop" });
      await scenes
        .getByRole("button", { name: "Switch program scene", exact: true })
        .click();
      await expect
        .poll(
          () =>
            server.state.scenes.find(
              (scene) => scene.id === server.state.program,
            )?.name,
        )
        .toBe("Community workshop");
      await scenes
        .getByLabel("Scene to edit", { exact: true })
        .selectOption({ label: "Workshop copy" });
      await scenes
        .getByRole("button", { name: "Delete selected scene", exact: true })
        .click();
      const confirmation = scenes.getByRole("region", {
        name: "Confirm OBS removal",
        exact: true,
      });
      await browserExpect(confirmation).toContainText("Workshop copy");
      expect(
        server.state.scenes.some((scene) => scene.name === "Workshop copy"),
      ).toBe(true);
      await confirmation
        .getByRole("button", { name: "Confirm scene deletion", exact: true })
        .click();
      await expect
        .poll(() =>
          server.state.scenes.some((scene) => scene.name === "Workshop copy"),
        )
        .toBe(false);
      expect(monitoring()).toEqual([]);
      expect(server.subscriptions.length).toBeGreaterThan(0);
      expect(
        server.subscriptions.every((value) => (value & (1 << 16)) === 0),
      ).toBe(true);
      expect(
        server.state.requests.some((request) =>
          [
            "GetStreamServiceSettings",
            "CreateInput",
            "SetInputSettings",
          ].includes(request.type),
        ),
      ).toBe(false);

      const beforeReload = mutations().length;
      await obsidian.reloadPlugin();
      view = await obsidian.openView(type);
      pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      await pages
        .getByRole("button", { name: "Broadcast", exact: true })
        .click();
      await browserExpect(
        view.getByRole("button", { name: "Disconnect OBS", exact: true }),
      ).toBeVisible();
      expect(mutations()).toHaveLength(beforeReload);
      expect(monitoring()).toEqual([]);
      expect(
        server.subscriptions.every((value) => (value & (1 << 16)) === 0),
      ).toBe(true);
      expect(server.state.active).toBe(false);
      expect(obsidian.errors()).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
