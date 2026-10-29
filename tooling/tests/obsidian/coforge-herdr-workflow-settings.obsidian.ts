import { openWorkflowSettings } from "../../../tests/e2e/support/workflow-navigation.ts";
import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
describe("Managed Herdr workflow configuration", () => {
  test("persists only explicit stage agent choices in canonical project notes across reload without launching an agent", async ({
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
      .fill("Contained Herdr configuration");
    await view
      .getByLabel(/^Project path/)
      .fill("/synthetic/herdr-configuration");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Configuration persistence only; never invoke Herdr.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await browserExpect(view.locator(".cf-project-switcher")).toContainText(
      "Contained Herdr configuration",
    );
    await openWorkflowSettings(view);
    await view.getByLabel("AI provider", { exact: true }).selectOption("herdr");
    await view
      .getByLabel("Herdr agent type", { exact: true })
      .selectOption("claude");
    await view.getByLabel("AI model", { exact: true }).fill("haiku");
    await view
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await browserExpect(
      view.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    const notes = await obsidian.eval(async ({ app }) =>
      Promise.all(
        app.vault
          .getMarkdownFiles()
          .filter((file) => file.path.startsWith("CoForge/Projects/"))
          .map((file) => app.vault.read(file)),
      ),
    );
    const note = notes.find((note) =>
      note.includes("Contained Herdr configuration"),
    );
    expect(note).toContain("provider: herdr");
    expect(note).toContain("model: haiku");
    expect(note).toContain("herdrAgent: claude");
    expect(note).not.toMatch(/^herdr-agent:/m);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await openWorkflowSettings(view);
    await browserExpect(
      view.getByLabel("AI provider", { exact: true }),
    ).toHaveValue("herdr");
    await browserExpect(
      view.getByLabel("Herdr agent type", { exact: true }),
    ).toHaveValue("claude");
    await browserExpect(
      view.getByLabel("AI model", { exact: true }),
    ).toHaveValue("haiku");
    await obsidian.screenshot("herdr-step-configuration");
    expect(obsidian.errors()).toEqual([]);
  });
});
