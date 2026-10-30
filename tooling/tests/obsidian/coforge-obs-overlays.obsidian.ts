import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture";
import { ObsProductionSocketServer } from "./support/obs-production-socket";
import { captureObsStudioVisuals } from "./support/obs-studio-visuals";
import { openProjectSettings } from "../../../tests/e2e/support/settings-navigation";

describe("Public OBS overlays in the contained host", () => {
  test("publishes only reviewed Council text, refreshes it from a show cue and revokes the owned copy on privacy changes", async ({
    obsidian,
  }) => {
    const server = new ObsProductionSocketServer();
    // The streamer has already authored this Text source in OBS.
    server.state.inputs = [
      {
        inputUuid: "council-text",
        inputName: "Council public text",
        inputKind: "text_gdiplus_v3",
      },
    ];
    server.state.inputSettings.set("Council public text", {
      text: "Council title placeholder",
    });
    await server.start();
    const approved =
      "The Council recommends testing the lantern prototype with the community.";
    const outgoing = `OBS public workshop\nCouncil excerpt\n${approved}`;
    const privatePrompt =
      "PRIVATE AGENT INSTRUCTIONS - NEVER PUBLISH THIS PROMPT";
    try {
      const type = `${obsidian.pluginId}-view-project-workbench`;
      let view = await obsidian.openView(type);
      await view.locator(".cf-project-switcher").click();
      await view
        .getByRole("button", { name: "Add project", exact: true })
        .click();
      await view
        .getByLabel("Project name", { exact: true })
        .fill("OBS public workshop");
      await view
        .getByLabel("Project visibility", { exact: true })
        .selectOption("public");
      await view
        .getByLabel(/^Project path/)
        .fill("/synthetic/obs-public-workshop");
      await view
        .getByLabel("Description", { exact: true })
        .fill(
          "A contained public project for reviewed OBS overlay publication.",
        );
      await view
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await browserExpect(view.locator(".cf-project-switcher")).toContainText(
        "OBS public workshop",
      );
      const projectId = (await view
        .locator(".cf-project-selector-id")
        .textContent())!.trim();
      await openProjectSettings(view, "General");
      await view
        .getByLabel("General agent prompt", { exact: true })
        .fill(privatePrompt);
      await view
        .getByRole("button", { name: "Save settings", exact: true })
        .click();
      await browserExpect(
        view.getByText("Settings saved", { exact: true }),
      ).toBeVisible();
      await view
        .getByRole("button", { name: "CoForge studio", exact: true })
        .click();
      const pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      await pages.getByRole("button", { name: "Setup", exact: true }).click();
      const skip = view.getByRole("button", {
        name: "Skip setup for now",
        exact: true,
      });
      if (await skip.isVisible()) await skip.click();
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

      const beforePublication = server.state.requests.filter(
        (request) => request.type === "SetInputSettings",
      ).length;
      await pages
        .getByRole("button", { name: "Public displays", exact: true })
        .click();
      const overlay = view.getByRole("region", {
        name: "Public OBS text overlay composer",
        exact: true,
      });
      await overlay
        .getByRole("button", {
          name: "Load public overlay choices",
          exact: true,
        })
        .click();
      await overlay.getByLabel(/^Public project/).selectOption(projectId);
      await overlay
        .getByRole("button", {
          name: "Load selected project content",
          exact: true,
        })
        .click();
      await overlay
        .getByLabel("Overlay name", { exact: true })
        .fill("Council spotlight");
      await overlay
        .getByLabel(/^Public content/)
        .selectOption("council-excerpt");
      await overlay
        .getByLabel(/^OBS text source/)
        .selectOption({ label: "Council public text" });
      await overlay
        .getByLabel(/^Authored Council excerpt for public display/)
        .fill(approved);
      await overlay
        .getByLabel("I approve the selected content for public display", {
          exact: true,
        })
        .check();
      await overlay
        .getByRole("button", {
          name: "Preview public overlay text",
          exact: true,
        })
        .click();
      await browserExpect(overlay.locator(".cf-overlay-outgoing")).toHaveText(
        outgoing,
      );
      await browserExpect(
        overlay.locator(".cf-overlay-outgoing"),
      ).not.toContainText(privatePrompt);
      expect(
        server.state.requests.filter(
          (request) => request.type === "SetInputSettings",
        ),
      ).toHaveLength(beforePublication);
      await overlay
        .getByLabel("Publish this captured text to Council public text", {
          exact: true,
        })
        .check();
      await overlay
        .getByRole("button", { name: "Publish reviewed overlay", exact: true })
        .click();
      await browserExpect(
        overlay.getByText(
          "OBS confirmed the public text update and the overlay mapping was saved.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect
        .poll(() => server.state.inputSettings.get("Council public text")?.text)
        .toBe(outgoing);
      const saved: unknown = JSON.parse(
        await obsidian.eval(({ app, pluginId }) =>
          app.vault.adapter.read(
            `${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`,
          ),
        ),
      );
      expect(saved).toMatchObject({
        obsShow: {
          overlays: [
            expect.objectContaining({
              name: "Council spotlight",
              kind: "council-excerpt",
              projectId,
              excerpt: approved,
              publicConfirmed: true,
              publication: expect.objectContaining({
                status: "published",
                text: outgoing,
              }),
            }),
          ],
        },
      });

      await pages
        .getByRole("button", { name: "Show plan", exact: true })
        .click();
      const show = view.getByRole("region", {
        name: "Show plans and cues",
        exact: true,
      });
      await show
        .getByRole("button", { name: "Create show plan", exact: true })
        .click();
      await show
        .getByLabel("Show plan name", { exact: true })
        .fill("Public Council segment");
      await show.getByLabel(/^Action to add/).selectOption("overlay");
      await show
        .getByLabel(/^Approved public overlay/)
        .selectOption({ label: "Council spotlight" });
      await show
        .getByRole("button", { name: "Add action to cue", exact: true })
        .click();
      await show
        .getByRole("button", { name: "Save show plan", exact: true })
        .click();
      const beforeCue = server.state.requests.filter(
        (request) => request.type === "SetInputSettings",
      ).length;
      await show
        .getByRole("button", { name: "Run selected cue", exact: true })
        .click();
      await expect
        .poll(
          () =>
            server.state.requests.filter(
              (request) => request.type === "SetInputSettings",
            ).length,
        )
        .toBe(beforeCue + 1);
      expect(server.state.inputSettings.get("Council public text")?.text).toBe(
        outgoing,
      );
      await browserExpect(
        show.getByRole("region", { name: "Latest cue outcome", exact: true }),
      ).toContainText("confirmed");
      await pages
        .getByRole("button", { name: "Public displays", exact: true })
        .click();
      await overlay
        .getByRole("button", {
          name: "Preview public overlay text",
          exact: true,
        })
        .click();
      await browserExpect(overlay.locator(".cf-overlay-outgoing")).toHaveText(
        outgoing,
      );
      await captureObsStudioVisuals(obsidian, view);

      const beforeReload = server.state.requests.filter(
        (request) => !request.type.startsWith("Get"),
      ).length;
      await obsidian.reloadPlugin();
      view = await obsidian.openView(type);
      await view
        .getByRole("navigation", { name: "Stream studio pages", exact: true })
        .getByRole("button", { name: "Public displays", exact: true })
        .click();
      await browserExpect(
        view.getByRole("region", {
          name: "Saved public overlay mappings",
          exact: true,
        }),
      ).toContainText("Council spotlight");
      await browserExpect(
        view.getByRole("button", {
          name: "Refresh Council spotlight",
          exact: true,
        }),
      ).toBeEnabled();
      expect(
        server.state.requests.filter(
          (request) => !request.type.startsWith("Get"),
        ).length,
      ).toBe(beforeReload);
      await openProjectSettings(view, "General");
      await view
        .getByLabel("Project visibility", { exact: true })
        .selectOption("private");
      await view
        .getByRole("button", { name: "Save settings", exact: true })
        .click();
      await expect
        .poll(() => server.state.inputSettings.get("Council public text")?.text)
        .toBe("");
      expect(
        server.state.requests.some(
          (request) =>
            request.type === "StartStream" ||
            request.type === "GetStreamServiceSettings",
        ),
      ).toBe(false);
      expect(obsidian.errors()).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
