import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";

describe("Live studio in the contained vault", () => {
  test("records manual income in the private canonical EUR ledger", async ({
    obsidian,
  }) => {
    const view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.getByRole("button", { name: "Finances", exact: true }).click();
    await view.getByLabel("Entry type", { exact: true }).selectOption("income");
    await view
      .getByLabel("Finance description", { exact: true })
      .fill("Contained stream income");
    await view.getByLabel("Amount (EUR)", { exact: true }).fill("50.05");
    await view
      .getByRole("button", { name: "Save finance entry", exact: true })
      .click();
    await browserExpect(
      view.getByRole("list", { name: "Finance entries", exact: true }),
    ).toContainText("Contained stream income");
    const content = await obsidian.eval(({ app }) =>
      app.vault.adapter.read("CoForge/Finance/Ledger.md"),
    );
    expect(content).toContain("currency: EUR");
    expect(content).toContain("amountCents: 5005");
    await obsidian.screenshot("manual-finance-ledger");
    expect(obsidian.errors()).toEqual([]);
  });
  test("saves music metadata and playlists without starting audio or Herdr", async ({
    obsidian,
  }) => {
    await obsidian.eval(async ({ app }) => {
      for (const folder of ["CoForge", "CoForge/Music"])
        if (!app.vault.getAbstractFileByPath(folder))
          await app.vault.createFolder(folder);
      await app.vault.createBinary(
        "CoForge/Music/Fixture.mp3",
        new Uint8Array([73, 68, 51]).buffer,
      );
    });
    const view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    const music = view.locator(".cf-music");
    await music.locator(":scope > summary").click();
    await music
      .getByRole("button", { name: "Refresh music library", exact: true })
      .click();
    await browserExpect(
      music.getByRole("button", {
        name: "Create metadata note for Fixture",
        exact: true,
      }),
    ).toBeVisible();
    await music
      .getByRole("button", { name: "Add to playlist: Fixture", exact: true })
      .click();
    await music
      .getByLabel("Playlist name", { exact: true })
      .fill("Contained playlist");
    await music
      .getByRole("button", { name: "Save playlist", exact: true })
      .click();
    await browserExpect(music).toContainText(
      "Playlist saved as a Markdown note.",
    );
    const notes = await obsidian.eval(async ({ app }) =>
      Promise.all(
        app.vault
          .getMarkdownFiles()
          .filter((file) => file.path.includes("/Playlists/"))
          .map((file) => app.vault.read(file)),
      ),
    );
    expect(
      notes.some(
        (content) =>
          content.includes("type: coforge-playlist") &&
          content.includes("CoForge/Music/Fixture.mp3"),
      ),
    ).toBe(true);
    await browserExpect(
      music.getByRole("region", { name: "Music playback", exact: true }),
    ).toContainText("stopped");
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Contained tools project');
    await view.getByLabel(/^Project path/).fill('/synthetic/game');
    await view.getByLabel('Description', { exact: true }).fill('Contained host integration checks.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await view.getByRole("button", { name: "Agent workflow", exact: true }).click();
    const herdr = view.locator(".cf-herdr");
    await herdr.locator(":scope > summary").click();
    await browserExpect(herdr).toContainText("start the chosen Herdr session");
    await browserExpect(
      herdr.getByRole("button", {
        name: "Send reviewed request to Herdr",
        exact: true,
      }),
    ).toHaveCount(0);
    await browserExpect(
      herdr.getByRole("button", { name: "Explore Herdr example", exact: true }),
    ).toHaveCount(0);
    expect(obsidian.errors()).toEqual([]);
  });
  test("keeps unavailable telemetry honest and scene controls disconnected across reload", async ({
    obsidian,
  }) => {
    const type = `${obsidian.pluginId}-view-project-workbench`;
    for (let pass = 0; pass < 2; pass++) {
      if (pass) await obsidian.reloadPlugin();
      const view = await obsidian.openView(type);
      const monitor = view.getByRole("region", {
        name: "Live stream monitor",
        exact: true,
      });
      await browserExpect(
        monitor.getByLabel("Live viewers", { exact: true }),
      ).toContainText("Unavailable");
      await browserExpect(
        monitor.getByLabel("Live OBS health", { exact: true }),
      ).toContainText("unavailable");
      await browserExpect(
        view.getByRole("button", {
          name: "Explore studio example",
          exact: true,
        }),
      ).toHaveCount(0);
      const scenes = view.locator(".cf-obs-scene-manager");
      await scenes.locator("summary").click();
      await browserExpect(scenes).toContainText(
        "Connect OBS in the setup controls",
      );
      await browserExpect(
        scenes.getByRole("button", {
          name: "Delete selected scene",
          exact: true,
        }),
      ).toHaveCount(0);
      await browserExpect(
        view.getByRole("button", { name: "Go live", exact: true }),
      ).toBeDisabled();
    }
    await obsidian.screenshot("live-studio-disconnected");
    expect(obsidian.errors()).toEqual([]);
  });
});
