import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
test("edits project stage prompts, retains drafts and isolates overrides", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Studio settings", exact: true })
    .click();
  await page.getByLabel("Workflow step", { exact: true }).selectOption("screen");
  await page
    .getByLabel("Project stage prompt", { exact: true })
    .fill("PROJECT_SCREEN_POLICY: explain product fit and reject scope creep.");
  await page.getByText("Preview assembled dispatch", { exact: true }).click();
  await expect(page.locator(".cf-prompt-preview pre").first()).toContainText(
    "PROJECT_SCREEN_POLICY",
  );
  await page
    .getByRole("button", { name: "Idea board", exact: false })
    .first()
    .click();
  await expect(
    page.getByLabel("Project stage prompt", { exact: true }),
  ).toHaveValue(
    "PROJECT_SCREEN_POLICY: explain product fit and reject scope creep.",
  );
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  await page.getByLabel("Workflow step", { exact: true }).selectOption("plan");
  await expect(
    page.getByLabel("Project stage prompt", { exact: true }),
  ).not.toHaveValue(/PROJECT_SCREEN_POLICY/);
  await page.getByLabel("Workflow step", { exact: true }).selectOption("screen");
  await page
    .getByRole("button", { name: "Reset selected stage prompt", exact: true })
    .click();
  await expect(
    page.getByLabel("Project stage prompt", { exact: true }),
  ).not.toHaveValue(/PROJECT_SCREEN_POLICY/);
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
});
test("shows each AI attempt, partial totals and a labelled manual fallback", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByRole("button", { name: "AI costs", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore example costs", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("example-build-1");
  await expect(page.getByRole("table")).toContainText("failed");
  await expect(page.locator(".cf-ai-summary")).toContainText("0.4625");
  await page
    .getByRole("button", {
      name: "Edit cost for CF-002 dispatch example-herdr-1",
      exact: true,
    })
    .click();
  const form = page.getByRole("form", { name: "Manual task cost" });
  await expect(form.getByLabel('Amount · USD', { exact: true })).toBeFocused();
  await form.getByLabel("Amount · USD", { exact: true }).fill("0.0375");
  await form
    .getByLabel("Source / note", { exact: true })
    .fill("Agent session usage report");
  await form
    .getByRole("button", { name: "Save manual cost", exact: true })
    .click();
  await expect(page.locator(".cf-ai-summary")).toContainText("0.50");
  await expect(page.getByRole("table")).toContainText("manual");
  await mkdir("reports/product-audit", { recursive: true });
  await page.screenshot({
    path: "reports/product-audit/ai-costs-desktop.png",
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page }).include(".cf-ai-costs").analyze();
  expect(axe.violations).toEqual([]);
});
test("saves a local stream plan, preserves its script and requires explicit preparation", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore example schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New stream plan", exact: true })
    .click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Community build night");
  await page.getByLabel(/^Start ·/).fill("2026-11-01T20:00");
  await page
    .getByLabel("Stream title", { exact: true })
    .fill("Building the village together");
  await page
    .getByRole("button", { name: "Save stream plan", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Stream script", exact: true }),
  ).toContainText("Storyboard");
  await expect(
    page.getByRole("button", { name: "Apply channel", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review saved preparation", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Prepare planned stream", exact: true }),
  ).toContainText("Building the village together");
  await expect(
    page.getByRole("button", { name: "Apply channel", exact: true }),
  ).toBeVisible();
  await mkdir("reports/product-audit", { recursive: true });
  await page.screenshot({
    path: "reports/product-audit/schedule-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.screenshot({
    path: "reports/product-audit/schedule-mobile.png",
    fullPage: true,
  });
  expect(
    await page
      .locator(".cf-content")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include(".cf-stream-schedule-page")
    .analyze();
  expect(axe.violations).toEqual([]);
});
test("opens a card action menu by mouse and keyboard without bypassing review", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Idea board", exact: false })
    .first()
    .click();
  const card = page
    .locator(".cf-idea-card")
    .filter({ hasText: "Let us pet the forest foxes" });
  await card.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: /Open CF-/ })).toBeVisible();
  await page.keyboard.press("Escape");
  const actions = card.getByRole("button", { name: /^Actions for CF-/ });
  await actions.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Copy request ID", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await mkdir("reports/product-audit", { recursive: true });
  await page.screenshot({
    path: "reports/product-audit/board-desktop.png",
    fullPage: true,
  });
});
