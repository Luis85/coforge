import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from "../support/workflow-navigation";
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const theme of ["light", "dark"])
  test(`Herdr configured step shows its verified profile and unavailable host capability in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
    }, theme);
    await openWorkflowSettings(page);
    await openWorkflowDisclosure(page, "Agent and project access");
    await page.getByLabel("AI provider", { exact: true }).selectOption("herdr");
    const agent = page.getByLabel("Herdr agent type", { exact: true });
    expect(await agent.locator("option").allTextContents()).toEqual([
      "Claude Code (default)",
      "Claude Code",
    ]);
    await agent.selectOption("claude");
    await page.getByLabel("AI model", { exact: true }).selectOption("haiku");
    const fields = page.getByRole("region", {
      name: "Selected workflow step",
      exact: true,
    });
    await expect(fields).toContainText(
      /Herdr workflow is unavailable|project path/,
    );
    await expect(fields).toContainText(
      "native CLI caps do not enforce Herdr spending",
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
    await mkdir("reports/herdr-workflow", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await fields.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await fields.screenshot({
        path: `reports/herdr-workflow/configured-${theme}-${width}.png`,
      });
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(".cf-workflow-settings-page")
          .analyze()
      ).violations,
    ).toEqual([]);
    await openWorkflowRuns(page);
    await expect(
      page.getByRole("list", { name: "Captured workflow steps", exact: true }),
    ).toContainText("Herdr · Claude Code · haiku");
    await expect(
      page.getByRole("region", {
        name: "Request workflow execution",
        exact: true,
      }),
    ).toContainText(/Herdr workflow is unavailable|project path/);
    await openWorkflowSettings(page);
    await openWorkflowDisclosure(page, "Agent and project access");
    await expect(agent).toHaveValue("claude");
  });
