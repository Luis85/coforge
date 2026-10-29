import { openWorkflowDisclosure, openWorkflowSettings } from "../support/workflow-navigation";
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
test("edits workflow instructions in the dedicated view and preserves local drafts", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await openWorkflowSettings(page);
    await openWorkflowDisclosure(page, "Workflow tools");
  await page
    .getByLabel("Step instructions", { exact: true })
    .fill("PROJECT_SCREEN_POLICY: explain product fit and reject scope creep.");
  await page
    .getByRole("button", { name: /^Idea board/ })
    .first()
    .click();
  await expect(
    page.getByLabel("Step instructions", { exact: true }),
  ).toHaveValue(
    "PROJECT_SCREEN_POLICY: explain product fit and reject scope creep.",
  );
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await expect(
    page.getByText(
      "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.locator('[data-step-id="plan"] .cf-workflow-step-select').click();
  await expect(
    page.getByLabel("Step instructions", { exact: true }),
  ).not.toHaveValue(/PROJECT_SCREEN_POLICY/);
  await page
    .locator('[data-step-id="screen"] .cf-workflow-step-select')
    .click();
  await expect(
    page.getByLabel("Step instructions", { exact: true }),
  ).toHaveValue(/PROJECT_SCREEN_POLICY/);
  await page
    .getByRole("button", { name: "Preview workflow export", exact: true })
    .click();
  await expect(
    page.getByLabel("Workflow export JSON", { exact: true }),
  ).toContainText("PROJECT_SCREEN_POLICY");
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
      name: "Add cost for CF-002 dispatch example-herdr-1",
      exact: true,
    })
    .click();
  const form = page.getByRole("form", { name: "Manual task cost" });
  await expect(form.getByLabel("Amount · USD", { exact: true })).toBeFocused();
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
