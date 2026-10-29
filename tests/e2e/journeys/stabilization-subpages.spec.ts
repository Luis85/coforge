import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { councilPageButton } from '../support/council-navigation';
import { openAgentWorkflow } from '../support/workflow-navigation';

async function capture(page: Page, scope: string, label: string, name: string) {
  const button = label === 'Council workspace'
    ? await councilPageButton(page, name)
    : page.getByRole("navigation", { name: label, exact: true }).getByRole("button", { name, exact: true });
  await button.focus();
  await button.press("Enter");
  await expect(button).toHaveAttribute("aria-current", "page");
  await mkdir("reports/stabilization-subpages", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.body.classList.toggle("theme-light", value === "light");
      document.body.classList.toggle("theme-dark", value === "dark");
    }, theme);
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page
          .locator(".cf-content")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.locator(scope).screenshot({
        path: `reports/stabilization-subpages/${label.replaceAll(" ", "-")}-${name.replaceAll(" ", "-")}-${theme}-${width}.png`,
      });
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(scope)
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test("focused broadcast pages are keyboard reachable and preserve setup drafts", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  for (const name of [
    "Broadcast",
    "Setup",
    "Scenes",
    "Music",
    "Public displays",
    "History",
  ])
    await capture(page, ".cf-broadcast-page", "Stream studio pages", name);
  await page
    .getByRole("navigation", { name: "Stream studio pages" })
    .getByRole("button", { name: "Setup", exact: true })
    .click();
  await page
    .getByLabel("OBS WebSocket URL", { exact: true })
    .fill("ws://localhost:5555/");
  await page
    .getByRole("navigation", { name: "Stream studio pages" })
    .getByRole("button", { name: "Broadcast", exact: true })
    .click();
  await expect(
    page.getByLabel("OBS WebSocket URL", { exact: true }),
  ).toBeHidden();
  await page
    .getByRole("navigation", { name: "Stream studio pages" })
    .getByRole("button", { name: "Setup", exact: true })
    .click();
  await expect(
    page.getByLabel("OBS WebSocket URL", { exact: true }),
  ).toHaveValue("ws://localhost:5555/");
  await page
    .getByRole("button", { name: "Open stream chat", exact: true })
    .click();
  await expect(page.locator('.cf-stream-page')).toBeVisible();
});

test("focused chat and workflow pages are keyboard reachable", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.locator('.cf-sidebar').getByRole('button', { name: 'Stream chat', exact: true }).click();
  for (const name of ["Chat", "Twitch settings", "Bot messages"])
    await capture(page, ".cf-stream-page", "Stream tools", name);
  await openAgentWorkflow(page);
  for (const name of ["Workflow runs", "Herdr workspaces", "Workflow settings"])
    await capture(page, ".cf-workflow-page", "Agent workflow pages", name);
});

test("Council authoring, folders, intake and execution are distinct accessible pages", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByRole("button", { name: "The Council", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore Council example", exact: true })
    .click();
  for (const name of [
    "Ask the Council",
    "Definitions",
    "Submit existing note",
    "Watched inboxes",
    "Run monitor",
    "Council workflows",
    "Team messages",
    "Definition folders",
  ])
    await capture(page, ".cf-council", "Council workspace", name);
});
