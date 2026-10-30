import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import {
  list,
  record,
} from "../../../src/plugin/features/coforge/domain/check";
import { test } from "./support/obsidian-fixture.ts";
import { ObsProductionSocketServer } from "./support/obs-production-socket";

describe("OBS music in the contained studio", () => {
  test("prepares disabled music sources, runs an explicit OBS cue and retains assignments after reload", async ({
    obsidian,
  }) => {
    const server = new ObsProductionSocketServer();
    server.state.scenes = [
      { id: "live", name: "Live" },
      { id: "brb", name: "BRB" },
    ];
    server.state.program = "live";
    server.state.preview = "live";
    server.state.inputs = [
      {
        inputUuid: "music",
        inputName: "Live music",
        inputKind: "ffmpeg_source",
      },
      {
        inputUuid: "break-music",
        inputName: "Break music",
        inputKind: "ffmpeg_source",
      },
    ];
    await server.start();
    try {
      const type = `${obsidian.pluginId}-view-project-workbench`;
      let view = await obsidian.openView(type);
      let pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      await pages.getByRole("button", { name: "Setup", exact: true }).click();
      await view
        .getByRole("button", { name: "Skip setup for now", exact: true })
        .click();
      await view
        .getByLabel("OBS WebSocket URL", { exact: true })
        .fill(server.endpoint);
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
      await view.locator(".cf-project-switcher").click();
      await view
        .getByRole("button", { name: "Add project", exact: true })
        .click();
      await view
        .getByLabel("Project name", { exact: true })
        .fill("Music rehearsal");
      await view.getByLabel(/^Project path/).fill("/synthetic/music-show");
      await view
        .getByLabel("Description", { exact: true })
        .fill("Contained music preparation and automation.");
      await view
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await browserExpect(view.locator(".cf-project-switcher")).toContainText(
        "Music rehearsal",
      );
      await view.getByRole("button", { name: "Schedule", exact: true }).click();
      await view
        .getByRole("button", { name: "New stream plan", exact: true })
        .click();
      await view
        .getByLabel("Plan name", { exact: true })
        .fill("Music rehearsal plan");
      await view.getByLabel(/^Start/).fill("2026-11-04T19:00");
      await view
        .getByRole("combobox", { name: "Live scene", exact: true })
        .selectOption("live");
      await view
        .getByRole("combobox", { name: "BRB scene", exact: true })
        .selectOption("brb");
      await view
        .getByRole("button", { name: "Refresh OBS music sources", exact: true })
        .click();
      await view
        .getByRole("combobox", { name: "Live scene music source", exact: true })
        .selectOption("music");
      await view
        .getByRole("combobox", { name: "BRB scene music source", exact: true })
        .selectOption("break-music");
      await view
        .getByRole("button", { name: "Save stream plan", exact: true })
        .click();
      await browserExpect(
        view.getByText("Stream plan saved. No live settings were changed.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        server.state.requests.some(
          (request) =>
            request.type === "CreateSceneItem" ||
            request.type === "TriggerMediaInputAction",
        ),
      ).toBe(false);
      await view
        .getByRole("button", { name: "Review saved preparation", exact: true })
        .click();
      await view
        .getByRole("button", { name: "Apply music", exact: true })
        .click();
      await browserExpect(
        view.getByText("Preparation step applied: music.", { exact: true }),
      ).toBeVisible();
      const liveMembership = await server.request("GetSceneItemList", {
        sceneName: "Live",
      });
      const [musicItem] = list(record)(liveMembership.sceneItems);
      if (!musicItem || typeof musicItem.sceneItemId !== "number")
        throw new Error("Missing observed music membership");
      expect(liveMembership).toMatchObject({
        sceneItems: [{ sourceUuid: "music", sceneItemEnabled: false }],
      });
      expect(
        await server.request("GetSceneItemList", { sceneName: "BRB" }),
      ).toMatchObject({
        sceneItems: [{ sourceUuid: "break-music", sceneItemEnabled: false }],
      });
      expect(
        server.state.requests.some(
          (request) => request.type === "TriggerMediaInputAction",
        ),
      ).toBe(false);
      await view
        .getByRole("button", { name: "Stream studio", exact: true })
        .click();
      pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      await pages
        .getByRole("button", { name: "Show plan", exact: true })
        .click();
      await view
        .getByRole("button", { name: "Create show plan", exact: true })
        .click();
      await view
        .getByRole("combobox", { name: "Action to add", exact: true })
        .selectOption("source-visible");
      await view
        .getByRole("combobox", { name: "Target scene", exact: true })
        .selectOption("live");
      await view
        .getByRole("spinbutton", { name: /^Scene item ID/ })
        .fill(String(musicItem.sceneItemId));
      await view
        .getByRole("checkbox", { name: "Show this source", exact: true })
        .check();
      await view
        .getByRole("button", { name: "Add action to cue", exact: true })
        .click();
      await view
        .getByRole("combobox", { name: "Action to add", exact: true })
        .selectOption("media");
      await view
        .getByRole("combobox", { name: "Target input", exact: true })
        .selectOption("music");
      await view
        .getByRole("combobox", { name: "Media action", exact: true })
        .selectOption("restart");
      await view
        .getByRole("button", { name: "Add action to cue", exact: true })
        .click();
      await view
        .getByRole("button", { name: "Save show plan", exact: true })
        .click();
      await browserExpect(
        view.getByText("Show plan saved. Saving never runs a cue.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        server.state.requests.some(
          (request) => request.type === "TriggerMediaInputAction",
        ),
      ).toBe(false);
      await view
        .getByRole("button", { name: "Run selected cue", exact: true })
        .click();
      await browserExpect(
        view.getByText("Cue completed. Review the observed OBS output.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(server.state.mediaState).toBe("OBS_MEDIA_STATE_PLAYING");
      expect(
        await server.request("GetSceneItemList", { sceneName: "Live" }),
      ).toMatchObject({
        sceneItems: [{ sourceUuid: "music", sceneItemEnabled: true }],
      });
      const playbackCalls = server.state.requests.filter(
        (request) => request.type === "TriggerMediaInputAction",
      ).length;
      await obsidian.reloadPlugin();
      view = await obsidian.openView(type);
      await view.getByRole("button", { name: "Schedule", exact: true }).click();
      await view.locator(".cf-schedule-item").click();
      await browserExpect(
        view.getByRole("combobox", {
          name: "Live scene music source",
          exact: true,
        }),
      ).toHaveValue("music");
      await browserExpect(
        view.getByRole("combobox", {
          name: "BRB scene music source",
          exact: true,
        }),
      ).toHaveValue("break-music");
      expect(
        server.state.requests.filter(
          (request) => request.type === "TriggerMediaInputAction",
        ),
      ).toHaveLength(playbackCalls);
      expect(
        server.state.requests.some((request) => request.type === "StartStream"),
      ).toBe(false);
      await obsidian.screenshot("obs-music-prepared");
      expect(obsidian.errors()).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
