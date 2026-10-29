import { test, expect } from "@playwright/test";
import { openCouncilPage } from '../support/council-navigation';
import { openAgentWorkflow } from '../support/workflow-navigation';
import { openProjectSettings } from '../support/settings-navigation';

const examples = [
  ["Finances", "Explore finance example", ".cf-finance"],
  ["AI costs", "Explore example costs", ".cf-ai-costs"],
  ["Schedule", "Explore example schedule", ".cf-stream-schedule-page"],
  ["Statistics", "Explore sample statistics", ".cf-statistics-page"],
  ["The Council", "Explore Council example", ".cf-council"],
] as const;

for (const [view, explore, selector] of examples) {
  test(`${view} example can be explicitly exited without changing workspace data`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page
      .locator(".cf-sidebar")
      .getByRole("button", { name: view, exact: true })
      .first()
      .click();
    const surface = page.locator(selector);
    await surface.getByRole("button", { name: explore, exact: true }).click();
    await expect(
      surface.getByRole("button", { name: "Exit example", exact: true }),
    ).toBeVisible();
    if (view === "Finances")
      await surface
        .getByLabel("Finance description", { exact: true })
        .fill("Temporary example draft");
    if (view === "Schedule")
      await surface
        .getByLabel("Plan name", { exact: true })
        .fill("Temporary example draft");
    await surface
      .getByRole("button", { name: "Exit example", exact: true })
      .click();
    await expect(
      surface.getByRole("button", { name: explore, exact: true }),
    ).toBeVisible();
    await expect(
      surface.getByRole("button", { name: "Exit example", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".cf-project-switcher")).toContainText(
      "Mosslight",
    );
    if (view === "Finances") {
      await surface.getByRole("button", { name: explore, exact: true }).click();
      await surface
        .getByLabel("Finance description", { exact: true })
        .fill("Discard saved sample payment");
      await surface.getByLabel("Amount (EUR)", { exact: true }).fill("12.50");
      await surface
        .getByRole("button", { name: "Save finance entry", exact: true })
        .click();
      await expect(surface.locator(".cf-finance-list")).toContainText(
        "Discard saved sample payment",
      );
      await surface
        .getByRole("button", { name: "Exit example", exact: true })
        .click();
      await surface.getByRole("button", { name: explore, exact: true }).click();
      await expect(surface.locator(".cf-finance-list")).not.toContainText(
        "Discard saved sample payment",
      );
    }
  });
}

test("live-monitor and music examples can be explicitly exited", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  const live = page.locator(".cf-live-studio");
  await live
    .getByRole("button", { name: "Explore studio example", exact: true })
    .click();
  await live.getByRole("button", { name: "Exit example", exact: true }).click();
  await expect(
    live.getByRole("button", { name: "Explore studio example", exact: true }),
  ).toBeVisible();
  await expect(live).not.toContainText("Example live metrics");
  await page
    .getByRole("navigation", { name: "Stream studio pages", exact: true })
    .getByRole("button", { name: "Music", exact: true })
    .click();
  const music = page.locator(".cf-music");
  await music
    .getByRole("button", { name: "Explore music example", exact: true })
    .click();
  await music
    .getByRole("button", { name: "Exit example", exact: true })
    .click();
  await expect(
    music.getByRole("button", { name: "Explore music example", exact: true }),
  ).toBeVisible();
  await expect(music.getByLabel("Music playback", { exact: true })).toHaveCount(
    0,
  );
});

test("Herdr example can be explicitly exited without a native command", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await openAgentWorkflow(page);
  await page
    .getByRole("navigation", { name: "Agent workflow pages", exact: true })
    .getByRole("button", { name: "Herdr workspaces", exact: true })
    .click();
  const herdr = page.locator(".cf-herdr");
  await herdr
    .getByRole("button", { name: "Explore Herdr example", exact: true })
    .click();
  await herdr
    .getByRole("button", { name: "Exit example", exact: true })
    .click();
  await expect(
    herdr.getByRole("button", { name: "Explore Herdr example", exact: true }),
  ).toBeVisible();
});

test("ordinary navigation retains temporary example drafts until explicit exit", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: "Finances", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore finance example", exact: true })
    .click();
  await page
    .getByLabel("Finance description", { exact: true })
    .fill("Keep this draft while navigating");
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: "Stream studio", exact: true })
    .click();
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: "Finances", exact: true })
    .click();
  await expect(
    page.getByLabel("Finance description", { exact: true }),
  ).toHaveValue("Keep this draft while navigating");
  await page.getByRole("button", { name: "Exit example", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore finance example", exact: true })
    .click();
  await expect(
    page.getByLabel("Finance description", { exact: true }),
  ).toHaveValue("");
});

test('explicit global cleanup closes an inactive scheduler example without retaining its temporary draft', async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  const sidebar = page.locator('.cf-sidebar');
  await sidebar.getByRole('button', { name: 'The Council', exact: true }).click();
  await page.getByRole('button', { name: 'Explore Council example', exact: true }).click();
  await openCouncilPage(page, 'Task scheduler');
  const scheduler = page.getByRole('region', { name: 'Task scheduler', exact: true });
  await scheduler.getByRole('button', { name: 'Explore scheduler example', exact: true }).click();
  await scheduler.getByRole('button', { name: 'New scheduled task', exact: true }).click();
  await scheduler.getByLabel('Task name', { exact: true }).fill('Discard only this temporary scheduler draft');
  await openProjectSettings(page, 'Data & examples');
  const cleanup = page.getByRole('region', { name: 'Remove example and local-test content', exact: true });
  await cleanup.getByRole('button', { name: 'Preview example cleanup', exact: true }).click();
  await cleanup.getByLabel('I reviewed the selected requests and local content above and want to remove them.', { exact: true }).check();
  await cleanup.getByRole('button', { name: 'Remove selected examples and local content', exact: true }).click();
  await expect(cleanup).toContainText('Temporary examples are closed.');
  await sidebar.getByRole('button', { name: 'The Council', exact: true }).click();
  await page.getByRole('button', { name: 'Explore Council example', exact: true }).click();
  await openCouncilPage(page, 'Task scheduler');
  await expect(scheduler.getByRole('button', { name: 'Explore scheduler example', exact: true })).toBeVisible();
  await scheduler.getByRole('button', { name: 'Explore scheduler example', exact: true }).click();
  await scheduler.getByRole('button', { name: 'New scheduled task', exact: true }).click();
  await expect(scheduler.getByLabel('Task name', { exact: true })).toHaveValue('');
  await expect(page.locator('.cf-project-switcher')).toContainText('Mosslight');
});
