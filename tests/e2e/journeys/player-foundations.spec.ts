import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function send(page: Page, text: string) {
  await page.getByLabel("Chat message", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Send chat message", exact: true })
    .click();
}
async function open(page: Page, theme: string) {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.evaluate((theme) => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme === "light");
  }, theme);
  await mkdir("reports/player-foundations", { recursive: true });
}
async function register(page: Page) {
  await page.getByRole("button", { name: "Stream chat", exact: true }).click();
  await page
    .getByRole("button", { name: "Test commands locally", exact: true })
    .click();
  await page.getByLabel("Simulated viewer name").fill("Riley");
  await send(page, "!register");
  await expect(page.getByLabel("Chat message", { exact: true })).toHaveValue(
    "",
  );
}
async function capture(page: Page, name: string) {
  await test
    .info()
    .attach(name, {
      body: await page.screenshot({
        path: `reports/player-foundations/${name}.png`,
        fullPage: true,
      }),
      contentType: "image/png",
    });
}
async function quality(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.width);
}
for (const theme of ["dark", "light"]) {
  for (const width of [1280, 360])
    test(`registered player management in ${theme} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, theme);
      await page
        .getByRole("button", { name: "Stream chat", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Test commands locally", exact: true })
        .click();
      await page.getByLabel("Simulated viewer name").fill("Riley");
      await send(page, "!request CFP-001 A lantern by the new bridge");
      await expect(
        page.getByLabel("Chat message", { exact: true }),
      ).toHaveValue("!request CFP-001 A lantern by the new bridge");
      await send(page, "!register");
      await expect(
        page.getByLabel("Chat message", { exact: true }),
      ).toHaveValue("");
      await send(page, "!request CFP-001 A lantern by the new bridge");
      await expect(
        page.getByLabel("Chat message", { exact: true }),
      ).toHaveValue("");
      await send(page, "!request CFP-001 A little garden by the new bridge");
      await expect(
        page.getByLabel("Chat message", { exact: true }),
      ).toHaveValue("!request CFP-001 A little garden by the new bridge");
      await page.getByRole("button", { name: "Viewers", exact: true }).click();
      await page
        .getByRole("button", { name: /Riley.*simulator:riley/ })
        .click();
      await expect(
        page.getByRole("complementary", { name: "Player details" }),
      ).toContainText("Feature cooldown:");
      await page
        .getByRole("button", { name: "Block participation", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm block", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Unblock participation",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Unblock participation", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm unblock", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Block participation", exact: true }),
      ).toBeVisible();
      await quality(page);
      await capture(page, `players-${theme}-${width}`);
    });
  test(`operations and earning rules in ${theme}`, async ({ page }) => {
    await open(page, theme);
    await register(page);
    await page.getByRole("button", { name: "Operations", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Event type", exact: true })
      .selectOption("registered");
    await expect(
      page.getByRole("region", { name: "Operational records" }),
    ).toContainText("Riley");
    await capture(page, "operations-" + theme + "-1280");
    await page
      .getByRole("button", { name: "Community settings", exact: true })
      .click();
    await page
      .getByLabel("Community actor name", { exact: true })
      .fill("Citizen");
    await page.getByLabel("Currency name", { exact: true }).fill("credits");
    await page.getByRole("button", { name: "Add rank", exact: true }).click();
    await expect(page.getByLabel("Rank 2 name", { exact: true })).toBeFocused();
    await page.getByLabel("Rank 2 name", { exact: true }).fill("Builder");
    await page.getByLabel("Rank 2 minimum XP", { exact: true }).fill("200");
    await page
      .getByRole("button", { name: "Save community settings", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Community settings saved" }),
    ).toBeVisible();
    await capture(page, `community-settings-${theme}-1280`);
    await page.setViewportSize({ width: 360, height: 900 });
    await quality(page);
    await capture(page, `community-settings-${theme}-360`);
  });
  test(`recurring message maintenance in ${theme}`, async ({ page }) => {
    await open(page, theme);
    await page
      .getByRole("button", { name: "Stream chat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Bot messages", exact: true })
      .click();
    await page
      .getByLabel("Message text", { exact: true })
      .fill("Join The Hood with !register");
    await page.getByLabel("Interval (minutes)", { exact: true }).fill("2");
    await page
      .getByRole("button", { name: "Add message", exact: true })
      .click();
    await expect(page.locator(".cf-stream-message-list")).toContainText(
      "Paused",
    );
    await page
      .getByRole("button", {
        name: "Activate Join The Hood with !register",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Connect a Twitch channel" }),
    ).toBeVisible();
    await capture(page, `messages-${theme}-1280`);
    await page.setViewportSize({ width: 360, height: 900 });
    await quality(page);
    await capture(page, `messages-${theme}-360`);
    await page
      .getByRole("button", {
        name: "Delete Join The Hood with !register",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Confirm deletion", exact: true })
      .click();
    await expect(
      page.getByText("No recurring messages yet.", { exact: true }),
    ).toBeVisible();
  });
}
