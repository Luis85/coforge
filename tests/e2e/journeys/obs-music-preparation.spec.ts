import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

for (const [theme, width] of [
  ["light", 1280],
  ["dark", 480],
] as const) {
  test(`OBS music preparation replaces the player in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((value) => {
      document.body.classList.toggle("theme-light", value === "light");
      document.body.classList.toggle("theme-dark", value === "dark");
    }, theme);
    await expect(
      page
        .getByRole("navigation", { name: "Stream studio pages", exact: true })
        .getByRole("button", { name: "Music", exact: true }),
    ).toHaveCount(0);
    await page
      .locator(".cf-sidebar")
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    const schedule = page.locator(".cf-stream-schedule-page");
    await schedule
      .getByRole("button", { name: "Explore example schedule", exact: true })
      .click();
    await schedule
      .getByRole("combobox", { name: "Project", exact: true })
      .selectOption("CFP-001");
    await schedule
      .getByLabel("Plan name", { exact: true })
      .fill("OBS music rehearsal");
    await schedule
      .locator('input[type="datetime-local"]')
      .fill("2026-11-04T19:00");
    await schedule
      .getByRole("button", { name: "Save stream plan", exact: true })
      .click();
    await expect(schedule).toContainText(
      "Stream plan saved. No live settings were changed.",
    );
    const music = schedule.getByRole("region", {
      name: "Planned OBS music",
      exact: true,
    });
    await expect(
      music.getByRole("combobox", {
        name: "Live scene music source",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      music.getByRole("combobox", {
        name: "BRB scene music source",
        exact: true,
      }),
    ).toBeVisible();
    await expect(music).toContainText("OBS owns the files and playback");
    await expect(schedule.locator(".cf-music")).toHaveCount(0);
    await expect(
      schedule.getByLabel("Music playlist", { exact: true }),
    ).toHaveCount(0);
    await schedule
      .getByRole("button", { name: "Review saved preparation", exact: true })
      .click();
    await schedule
      .getByRole("button", { name: "Apply music", exact: true })
      .click();
    await expect(schedule.getByRole("alert")).toContainText(
      "Preparing OBS music requires the Obsidian plugin.",
    );
    expect(
      await music.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    const a11y = await new AxeBuilder({ page })
      .include(".cf-stream-schedule-page")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    await mkdir("reports/obs-music", { recursive: true });
    await music.screenshot({ path: `reports/obs-music/${theme}-${width}.png` });
    await test
      .info()
      .attach(`obs-music-${theme}-${width}`, {
        path: `reports/obs-music/${theme}-${width}.png`,
        contentType: "image/png",
      });
  });
}
