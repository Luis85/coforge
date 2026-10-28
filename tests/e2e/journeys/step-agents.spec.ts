import { test, expect, type Page } from "@playwright/test";
async function openEditor(page: Page) {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Workflow settings", exact: true })
    .first()
    .click();
}
async function step(page: Page, id: string, provider: string, model: string) {
  await page.locator(`[data-step-id="${id}"] .cf-workflow-step-select`).click();
  await page.getByLabel("AI provider", { exact: true }).selectOption(provider);
  if (provider !== "demo")
    await page.getByLabel("AI model", { exact: true }).fill(model);
}
async function save(page: Page) {
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await expect(
    page.getByText(
      "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
      { exact: true },
    ),
  ).toBeVisible();
}
test("configures explicit mixed step agents independently and restores the standard definition in the dedicated editor", async ({
  page,
}) => {
  await openEditor(page);
  await step(page, "screen", "claude", "haiku");
  await step(page, "plan", "claude", "sonnet");
  await save(page);
  await expect(page.locator(".cf-topbar .cf-provider-pill")).toContainText(
    "Mixed providers",
  );
  await page
    .getByRole("button", { name: "Agent workflow", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "Captured workflow steps", exact: true }),
  ).toContainText("haiku");
  await page
    .getByRole("button", { name: "Workflow settings", exact: true })
    .first()
    .click();
  await page
    .locator('[data-step-id="screen"] .cf-workflow-step-select')
    .click();
  await expect(page.getByLabel("AI model", { exact: true })).toHaveValue(
    "haiku",
  );
  await page.getByText("Standard step presets", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Replace draft with standard workflow",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("AI provider", { exact: true })).toHaveValue(
    "demo",
  );
  await expect(page.getByLabel("AI model", { exact: true })).toBeDisabled();
  await save(page);
});
test("keeps each project’s explicit step models separate", async ({ page }) => {
  await openEditor(page);
  await step(page, "screen", "claude", "haiku");
  await save(page);
  await page.locator(".cf-project-switcher").click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Orbit garden");
  await page.getByLabel(/^Project path/).fill("/synthetic/orbit-garden");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A separate community project for workflow configuration.");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.locator(".cf-project-switcher")).toContainText(
    "Orbit garden",
  );
  await page
    .getByRole("button", { name: "Workflow settings", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("AI provider", { exact: true })).toHaveValue(
    "demo",
  );
  await step(page, "plan", "claude", "opus");
  await save(page);
  await page.locator(".cf-project-switcher").click();
  await page
    .getByRole("button", { name: "Settings for Mosslight", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Workflow settings", exact: true })
    .first()
    .click();
  await page
    .locator('[data-step-id="screen"] .cf-workflow-step-select')
    .click();
  await expect(page.getByLabel("AI provider", { exact: true })).toHaveValue(
    "claude",
  );
  await expect(page.getByLabel("AI model", { exact: true })).toHaveValue(
    "haiku",
  );
  await page.locator('[data-step-id="plan"] .cf-workflow-step-select').click();
  await expect(page.getByLabel("AI provider", { exact: true })).toHaveValue(
    "demo",
  );
});
test("keeps an invalid explicit model draft and prevents navigation from discarding it", async ({
  page,
}) => {
  await openEditor(page);
  await step(page, "screen", "claude", "not a model");
  await expect(
    page.getByRole("button", { name: "Save workflow", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Agent workflow", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workflow settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("AI model", { exact: true })).toHaveValue(
    "not a model",
  );
  await page.getByLabel("AI model", { exact: true }).fill("haiku");
  await save(page);
  await page
    .getByRole("button", { name: "Agent workflow", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "Captured workflow steps", exact: true }),
  ).toContainText("haiku");
});
