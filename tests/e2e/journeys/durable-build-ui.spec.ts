import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import {
  openWorkflowDisclosure,
  openWorkflowSettings,
} from "../support/workflow-navigation";
import { parseWorkflowDefinition } from "../../../src/plugin/features/coforge/domain/configured-workflow";

test("explicitly saves future background Build policy without raising inherited caps or running a provider", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await openWorkflowSettings(page);
  await page
    .locator('[data-step-id="implement"] .cf-workflow-step-select')
    .click();
  await openWorkflowDisclosure(page, "Agent and project access");
  await page.getByLabel("AI provider", { exact: true }).selectOption("claude");
  await page
    .getByLabel("Build execution policy", { exact: true })
    .selectOption("background");
  await page.getByLabel("Set an elapsed deadline", { exact: true }).check();
  await page.getByLabel("Build deadline hours", { exact: true }).fill("120");
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await expect(page.locator(".cf-workflow-editor-notice")).toContainText(
    "Workflow saved.",
  );
  await openWorkflowDisclosure(page, "Workflow tools");
  await page
    .getByRole("button", { name: "Preview workflow export", exact: true })
    .click();
  const definition = parseWorkflowDefinition(
    (await page
      .getByLabel("Workflow export JSON", { exact: true })
      .textContent()) ?? "",
  );
  const build = definition.steps.find((step) => step.id === "implement");
  expect(build?.kind === "ai" ? build.execution : undefined).toEqual({
    mode: "background",
    idleWarningSeconds: 1800,
    maxRuntimeSeconds: 432000,
  });
  expect(definition.limits.maxTurns).toBe(12);
  expect(definition.limits.maxBudgetUsd).toBe(1);
  await page
    .getByRole("button", { name: "Close JSON panel", exact: true })
    .click();
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: /^Idea board/ })
    .click();
  await openWorkflowSettings(page);
  await page
    .locator('[data-step-id="implement"] .cf-workflow-step-select')
    .click();
  await expect(
    page.getByLabel("Build execution policy", { exact: true }),
  ).toHaveValue("background");
  await expect(
    page.getByLabel("Build deadline hours", { exact: true }),
  ).toHaveValue("120");
  await mkdir("reports/durable-build-ui", { recursive: true });
  for (const [width, theme] of [
    [1280, "dark"],
    [360, "light"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-dark", theme === "dark");
      document.body.classList.toggle("theme-light", theme === "light");
    }, theme);
    const policy = page.getByRole("region", {
      name: "Build execution settings",
      exact: true,
    });
    expect(
      await policy.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Build execution settings"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await policy.screenshot({
      path: `reports/durable-build-ui/policy-${theme}-${width}.png`,
    });
  }
});

test("edits both vault-wide admission limits and the Node path before a separate no-Build readiness check", async ({
  page,
}) => {
  await page.goto("/#surface=node-2");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  const settings = page.locator(".cf-plugin-settings");
  await settings
    .getByLabel("Worker Node executable", { exact: true })
    .fill("C:/Synthetic/node.exe");
  await settings
    .getByLabel("Concurrent background Builds", { exact: true })
    .fill("3");
  await settings
    .getByLabel("Concurrent short tasks", { exact: true })
    .fill("2");
  const check = settings.getByRole("button", {
    name: "Check background worker",
    exact: true,
  });
  await expect(check).toBeDisabled();
  await settings
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    settings.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await expect(check).toBeEnabled();
  await check.click();
  await expect(
    settings
      .locator(".cf-setting-row")
      .filter({ hasText: "Worker readiness" })
      .getByRole("status"),
  ).toContainText(/worker/i);
  await expect(
    settings.getByLabel("Concurrent background Builds", { exact: true }),
  ).toHaveValue("3");
  await expect(
    settings.getByLabel("Concurrent short tasks", { exact: true }),
  ).toHaveValue("2");
});
