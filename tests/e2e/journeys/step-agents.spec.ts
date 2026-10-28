import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function openSettings(page: Page) {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Studio settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workflow steps", exact: true }),
  ).toBeVisible();
}
async function save(page: Page) {
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
}
async function step(page: Page, stage: string, provider: string, model = "") {
  await page.getByLabel("Workflow step", { exact: true }).selectOption(stage);
  await page
    .getByLabel("Step provider", { exact: true })
    .selectOption(provider);
  if (provider === "claude")
    await page.getByLabel("Step model", { exact: true }).fill(model);
}

test("configures mixed step agents and restores independent project-default inheritance", async ({
  page,
}) => {
  await openSettings(page);
  await page
    .getByLabel("Workflow step", { exact: true })
    .selectOption("screen");
  await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Step model", { exact: true })).toBeDisabled();
  await step(page, "screen", "claude", "haiku");
  await step(page, "plan", "claude", "sonnet");
  await save(page);
  await expect(page.locator(".cf-topbar .cf-provider-pill")).toContainText(
    "Mixed providers",
  );
  const section = page
    .locator(".cf-settings-section")
    .filter({
      has: page.getByRole("heading", { name: "Workflow steps", exact: true }),
    });
  await mkdir("reports/step-agents", { recursive: true });
  await section.screenshot({ path: "reports/step-agents/config-desktop.png" });
  await page.setViewportSize({ width: 360, height: 900 });
  expect(
    await section.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include(".cf-settings-page")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await section.screenshot({ path: "reports/step-agents/config-narrow.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Agent workflow", exact: true })
    .click();
  const stages = page.locator(".cf-workflow-stage");
  await expect(stages.nth(0)).toContainText("haiku");
  await expect(stages.nth(0)).toContainText("Claude Code");
  await expect(stages.nth(2)).toContainText("sonnet");
  await page
    .getByRole("button", { name: "Studio settings", exact: true })
    .click();
  await page
    .getByLabel("Workflow step", { exact: true })
    .selectOption("screen");
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue(
    "haiku",
  );
  await page
    .getByRole("button", {
      name: "Use project defaults for this step",
      exact: true,
    })
    .click();
  await save(page);
  await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Step model", { exact: true })).toBeDisabled();
  await page.getByLabel("Workflow step", { exact: true }).selectOption("plan");
  await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
    "claude",
  );
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue(
    "sonnet",
  );
  await page
    .getByRole("button", {
      name: "Use project defaults for this step",
      exact: true,
    })
    .click();
  await save(page);
  await expect(page.locator(".cf-topbar .cf-provider-pill")).not.toContainText(
    "Mixed providers",
  );
});

test("keeps each project's step providers and models separate", async ({
  page,
}) => {
  await openSettings(page);
  await step(page, "screen", "claude", "haiku");
  await save(page);
  await page.locator(".cf-project-switcher").click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Orbit garden");
  await page.getByLabel(/^Project path/).fill("/synthetic/orbit-garden");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A separate community project for step-agent settings.");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Studio settings", exact: true })
    .click();
  await page
    .getByLabel("Workflow step", { exact: true })
    .selectOption("screen");
  await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue("");
  await step(page, "plan", "claude", "opus");
  await save(page);
  await page.locator(".cf-project-switcher").click();
  await page
    .getByRole("button", { name: "Settings for Mosslight", exact: true })
    .click();
  await page
    .getByLabel("Workflow step", { exact: true })
    .selectOption("screen");
  await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
    "claude",
  );
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue(
    "haiku",
  );
  await page.getByLabel("Workflow step", { exact: true }).selectOption("plan");
  await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue("");
});

test("keeps an invalid model draft and prevents navigation from silently discarding it", async ({
  page,
}) => {
  await openSettings(page);
  await step(page, "screen", "claude", "not a model");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue(
    "not a model",
  );
  await expect(page.getByText("Settings saved", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Agent workflow", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workflow steps", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Step model", { exact: true })).toHaveValue(
    "not a model",
  );
  await page.getByLabel("Step model", { exact: true }).fill("haiku");
  await save(page);
  await page
    .getByRole("button", { name: "Agent workflow", exact: true })
    .click();
  await expect(page.locator(".cf-workflow-stage").first()).toContainText(
    "haiku",
  );
});
