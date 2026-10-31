import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture";
import {
  openWorkflowDisclosure,
  openWorkflowSettings,
} from "../../../tests/e2e/support/workflow-navigation";

const title = "Native activity " + "W".repeat(100);

describe("Durable Build configuration and studio activity in the contained host", () => {
  test("saves future Build policy and Node/lane settings across reload without running a provider, and keeps activity inside its viewport", async ({
    obsidian,
  }) => {
    let view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.locator(".cf-project-switcher").click();
    await view
      .getByRole("button", { name: "Add project", exact: true })
      .click();
    await view
      .getByLabel("Project name", { exact: true })
      .fill("Durable UI verification");
    await view.getByLabel(/^Project path/).fill("/synthetic/durable-ui");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Configuration and observation only; no provider admission.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await openWorkflowSettings(view);
    await view
      .locator('[data-step-id="implement"] .cf-workflow-step-select')
      .click();
    await openWorkflowDisclosure(view, "Agent and project access");
    await view
      .getByLabel("AI provider", { exact: true })
      .selectOption("claude");
    await view
      .getByLabel("Build execution policy", { exact: true })
      .selectOption("background");
    await view.getByLabel("Set an elapsed deadline", { exact: true }).check();
    await view.getByLabel("Build deadline hours", { exact: true }).fill("120");
    await view
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await browserExpect(
      view.locator(".cf-workflow-editor-notice"),
    ).toContainText("Workflow saved.");
    const settingsWindow = obsidian.page.context().waitForEvent("page");
    await obsidian.runCommand("app:open-settings");
    const settings = await settingsWindow;
    await settings.waitForLoadState("domcontentloaded");
    await settings
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: /^CoForge$/ })
      .last()
      .click();
    await settings
      .getByLabel("Worker Node executable", { exact: true })
      .fill(process.execPath);
    await settings
      .getByLabel("Concurrent background Builds", { exact: true })
      .fill("3");
    await settings
      .getByLabel("Concurrent short tasks", { exact: true })
      .fill("2");
    await settings
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await browserExpect(
      settings.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeDisabled();
    const check = settings.getByRole("button", {
      name: "Check background worker",
      exact: true,
    });
    await browserExpect(check).toBeEnabled();
    await check.click();
    await browserExpect(check).toBeEnabled();
    await settings.close();
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await openWorkflowSettings(view);
    await view
      .locator('[data-step-id="implement"] .cf-workflow-step-select')
      .click();
    await browserExpect(
      view.getByLabel("Build execution policy", { exact: true }),
    ).toHaveValue("background");
    await browserExpect(
      view.getByLabel("Build deadline hours", { exact: true }),
    ).toHaveValue("120");
    await view.getByRole('region', { name: 'Build execution settings', exact: true }).evaluate(element => element.scrollIntoView({ block: 'start' }));
    await obsidian.screenshot("saved-background-build-policy");
    await view
      .locator(".cf-sidebar")
      .getByRole("button", { name: /^Idea board/ })
      .click();
    await view
      .locator(".cf-board-page > .cf-page-heading")
      .getByRole("button", { name: "New request", exact: true })
      .click();
    const intake = view.getByRole("dialog", {
      name: "New request",
      exact: true,
    });
    await intake.getByLabel("The idea", { exact: true }).fill(title);
    await intake
      .getByLabel("A little more context", { exact: true })
      .fill("A long retained activity event must wrap in the native host.");
    await intake
      .getByRole("button", { name: "Add to the board", exact: true })
      .click();
    const notification = view.getByRole("region", { name: /Notifications/ });
    const dismiss = notification.getByRole("button", {
      name: "Dismiss notification",
      exact: true,
    });
    while (await dismiss.count()) await dismiss.first().click();
    await view
      .getByRole("button", { name: "Recent activity", exact: true })
      .click();
    const popup = view.getByRole("complementary", {
      name: "Studio activity",
      exact: true,
    });
    for (const [width, height, theme] of [
      [1440, 900, "dark"],
      [820, 700, "light"],
    ] as const) {
      await obsidian.page.setViewportSize({ width, height });
      await obsidian.eval((_context, theme) => {
        document.body.classList.toggle("theme-dark", theme === "dark");
        document.body.classList.toggle("theme-light", theme === "light");
      }, theme);
      await browserExpect(popup).toBeVisible();
      const bounds = await popup.evaluate((element) => {
        const scroll = element.querySelector(".cf-activity-scroll");
        if (!scroll) throw new Error("Activity viewport missing");
        const panel = element.getBoundingClientRect();
        const viewport = scroll.getBoundingClientRect();
        return {
          fits: scroll.scrollWidth <= scroll.clientWidth + 1,
          vertical:
            panel.bottom <= window.innerHeight + 1 &&
            viewport.bottom <= panel.bottom + 1,
          rows: [
            ...scroll.querySelectorAll(
              ".cf-activity-body, .cf-activity-action",
            ),
          ].every((child) => {
            const box = child.getBoundingClientRect();
            return (
              box.left >= viewport.left - 1 && box.right <= viewport.right + 1
            );
          }),
        };
      });
      expect(bounds).toEqual({ fits: true, vertical: true, rows: true });
      await browserExpect(
        popup.locator(".cf-activity-item[disabled]"),
      ).toHaveCount(0);
      await browserExpect(popup.locator("time").first()).toHaveAttribute(
        "datetime",
        /\d{4}-\d\d-\d\dT/,
      );
      await obsidian.screenshot(`native-activity-${theme}-${width}`);
    }
    await popup
      .getByRole("button", { name: "Close activity", exact: true })
      .click();
    await browserExpect(
      view.getByRole("button", { name: "Recent activity", exact: true }),
    ).toBeFocused();
    const jobs = await obsidian.eval(async ({ app, pluginId }) => {
      const folder =
        app.plugins.manifests[pluginId]?.dir ??
        `${app.vault.configDir}/plugins/${pluginId}`;
      const value: unknown = JSON.parse(
        await app.vault.adapter.read(`${folder}/coforge-state.json`),
      );
      if (
        !value ||
        typeof value !== "object" ||
        !("jobs" in value) ||
        !Array.isArray(value.jobs)
      )
        throw new Error("Private job history unavailable");
      return value.jobs.length;
    });
    expect(jobs).toBe(0);
    expect(obsidian.errors()).toEqual([]);
  });
});
