import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const theme of ["light", "dark"])
  test(`music playlists and player in ${theme}`, async ({ page }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-dark", theme === "dark");
      document.body.classList.toggle("theme-light", theme === "light");
    }, theme);
    const music = page.locator(".cf-music");
    await page
      .getByRole("navigation", { name: "Stream studio pages" })
      .getByRole("button", { name: "Music", exact: true })
      .click();
    await music
      .getByRole("button", { name: "Explore music example", exact: true })
      .click();
    await expect(music).toContainText("synthetic library");
    await music
      .getByLabel("Playlist name", { exact: true })
      .fill("Evening stream");
    await music
      .getByRole("button", {
        name: "Add to playlist: Example Lanterns",
        exact: true,
      })
      .click();
    await music
      .getByRole("button", {
        name: "Add to playlist: Example Rooftops",
        exact: true,
      })
      .click();
    await music
      .getByRole("button", { name: "Move playlist track 2 up", exact: true })
      .click();
    await music
      .getByRole("button", { name: "Save playlist", exact: true })
      .click();
    await expect(
      music
        .getByLabel("Saved playlist", { exact: true })
        .locator("option:checked"),
    ).toContainText("Evening stream");
    await music
      .getByRole("button", { name: "Play saved playlist", exact: true })
      .click();
    const playback = music.getByRole("region", {
      name: "Music playback",
      exact: true,
    });
    await expect(playback).toContainText("Example Rooftops");
    await music
      .getByRole("button", { name: "Pause music", exact: true })
      .click();
    await expect(
      music.getByRole("button", { name: "Resume music", exact: true }),
    ).toBeEnabled();
    await music
      .getByRole("button", { name: "Resume music", exact: true })
      .click();
    await music
      .getByRole("button", { name: "Next track", exact: true })
      .click();
    await expect(playback).toContainText("Example Lanterns");
    await page
      .getByRole("button", { name: "Open stream chat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Stream studio", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Stream studio pages" })
      .getByRole("button", { name: "Music", exact: true })
      .click();
    await expect(playback).toContainText("playing");
    await mkdir("reports/stream-music", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await test.info().attach(`music-${theme}-${width}`, {
        body: await music.screenshot({
          path: `reports/stream-music/${theme}-${width}.png`,
        }),
        contentType: "image/png",
      });
    }
    await music
      .getByRole("button", { name: "Stop music", exact: true })
      .click();
    await expect(playback).toContainText("stopped");
  });
