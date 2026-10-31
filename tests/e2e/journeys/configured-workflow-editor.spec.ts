import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings, openWorkflowAttempts } from "../support/workflow-navigation";
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
async function editor(page: Page) {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await openWorkflowSettings(page);
    await openWorkflowDisclosure(page, "Workflow tools");
    await openWorkflowDisclosure(page, "Add a step");
  await expect(
    page.getByRole("heading", { name: "Idea Board Workflow", exact: true }),
  ).toBeVisible();
}
const definition = {
  format: "coforge-workflow/v1",
  revision: "imported-review",
  name: "Community review",
  limits: {
    timeoutSeconds: 180,
    maxTurns: 12,
    maxBudgetUsd: 1,
    intervalSeconds: 5,
  },
  steps: [
    {
      id: "scope",
      kind: "approval",
      name: "Approve scope",
      instructions: "Read the **scope** before proceeding.",
    },
    {
      id: "report",
      kind: "ai",
      name: "Explore options",
      instructions: "Provide a short Markdown report.",
      output: "markdown",
      access: "none",
      provider: "demo",
      model: "sonnet",
      automatic: false,
      minVotes: 0,
    },
    {
      id: "review",
      kind: "checklist",
      name: "Review options",
      instructions: "Inspect the report before finishing.",
      items: [
        { id: "inspect", label: "I inspected the report", required: true },
        { id: "share", label: "Share a follow-up if useful", required: false },
      ],
    },
  ],
};
for (const theme of ["light", "dark"]) {
  test(`workflow editor manages stable ordered steps and JSON draft boundaries in ${theme}`, async ({
    page,
  }) => {
    await editor(page);
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
    }, theme);
    const steps = page.getByRole("region", {
      name: "Workflow step order",
      exact: true,
    });
    await expect(steps.locator('[data-step-id]')).toHaveCount(5);
    await expect(steps).toContainText('Design');
    await page.getByLabel("Step name", { exact: true }).fill("Request review");
    await page
      .getByRole("button", { name: "Move Request review down", exact: true })
      .click();
    await expect(steps.locator('[data-step-id]').nth(1)).toHaveAttribute(
      "data-step-id",
      "screen",
    );
    await page
      .getByRole("button", { name: "Duplicate Request review", exact: true })
      .click();
    await expect(steps.locator('[data-step-id]')).toHaveCount(6);
    await page
      .getByRole("button", {
        name: "Remove Request review copy from workflow",
        exact: true,
      })
      .click();
    await expect(steps.locator('[data-step-id]')).toHaveCount(5);
    await page
      .getByRole("button", { name: "Add checklist", exact: true })
      .click();
    await page
      .getByLabel("Step name", { exact: true })
      .fill("Streamer checklist");
    await page
      .getByLabel("Checklist item 1", { exact: true })
      .fill("Inspect the result");
    await page
      .getByRole("button", { name: "Preview workflow export", exact: true })
      .click();
    const json = page.getByLabel("Workflow export JSON", { exact: true });
    await expect(json).toContainText("Streamer checklist");
    await expect(json).not.toContainText("projectPath");
    await expect(json).not.toContainText("projectBrief");
    await page
      .getByRole("button", { name: "Close JSON panel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    await page
      .getByLabel("Or paste workflow JSON", { exact: true })
      .fill(JSON.stringify(definition));
    await page
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await expect(
      page.getByRole("region", {
        name: "Workflow import preview",
        exact: true,
      }),
    ).toContainText("Community review");
    await expect(
      page.getByLabel("Workflow name", { exact: true }),
    ).not.toHaveValue("Community review");
    await page
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    await expect(page.getByLabel("Workflow name", { exact: true })).toHaveValue(
      "Community review",
    );
    await page
      .getByRole("button", { name: /^Idea board/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Idea Board Workflow", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await expect(
      page.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    await mkdir("reports/configured-workflows", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page
          .locator(".cf-workflow-settings-page")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page
        .locator(".cf-workflow-settings-page")
        .screenshot({
          path: `reports/configured-workflows/editor-${theme}-${width}.png`,
        });
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(".cf-workflow-settings-page")
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test(`custom AI and manual steps execute the imported order without shipped credit in ${theme}`, async ({
    page,
  }) => {
    await editor(page);
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
    }, theme);
    await page
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    await page
      .getByLabel("Or paste workflow JSON", { exact: true })
      .fill(JSON.stringify(definition));
    await page
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await expect(
      page.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    await openWorkflowRuns(page, 'CF-101');
    const run = page.getByRole("region", {
      name: "Request workflow execution",
      exact: true,
    });
    await run
      .getByRole("button", { name: "Start · Approve scope", exact: true })
      .click();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Adjust score", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".cf-idea-drawer")).toContainText(
      "This run uses captured RICE evidence",
    );
    await page
      .getByRole("button", { name: "Close idea details", exact: true })
      .click();
    await openWorkflowRuns(page, 'CF-101');
    const manual = page.getByRole("region", {
      name: "Manual workflow step",
      exact: true,
    });
    await expect(manual.locator("strong")).toHaveText("scope");
    await manual
      .getByRole("button", { name: "Approve workflow step", exact: true })
      .click();
    await run
      .getByRole("button", { name: "Run · Explore options", exact: true })
      .click();
    await expect(
      manual.getByRole("heading", { name: "Review options", exact: true }),
    ).toBeVisible();
    const complete = manual.getByRole("button", {
      name: "Complete checklist step",
      exact: true,
    });
    await expect(complete).toBeDisabled();
    await manual
      .getByLabel("I inspected the report · required", { exact: true })
      .check();
    await expect(complete).toBeEnabled();
    await complete.click();
    await expect(run).toContainText(
      "Workflow finished without pending code changes",
    );
    await expect(
      run.getByRole("button", { name: "Review code changes", exact: true }),
    ).toHaveCount(0);
    await mkdir("reports/configured-workflows", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page
          .locator(".cf-idea-drawer")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page
        .locator(".cf-idea-drawer")
        .screenshot({
          path: `reports/configured-workflows/run-${theme}-${width}.png`,
        });
    }
    expect(
      (await new AxeBuilder({ page }).include(".cf-idea-drawer").analyze())
        .violations,
    ).toEqual([]);
    await openWorkflowAttempts(page);
    await expect(page.getByRole("heading", { name: "Step attempts", exact: true })).toBeVisible();
  });
}
