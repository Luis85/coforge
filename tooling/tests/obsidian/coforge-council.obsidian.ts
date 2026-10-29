import { openCouncilPage } from '../../../tests/e2e/support/council-navigation';
import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";

describe("Council definitions and isolated note simulation in Obsidian", () => {
  test("edits a canonical agent after rename, simulates to a separate note and reloads paused", async ({
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
      .fill("Contained Council project");
    await view.getByLabel(/^Project path/).fill("/synthetic/council");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Contained Council simulation without model calls.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await browserExpect(view.locator(".cf-project-switcher")).toContainText(
      "Contained Council project",
    );
    await view
      .getByRole("button", { name: "The Council", exact: true })
      .click();
    await openCouncilPage(view, 'Definitions');
    await view
      .getByRole("button", { name: "Create default team", exact: true })
      .click();
    await browserExpect(
      view.locator(".cf-council-definition-list"),
    ).toContainText("Studio team");
    await view
      .getByRole("button", { name: "Create agent", exact: true })
      .click();
    await view
      .getByLabel("Definition name", { exact: true })
      .fill("Native reviewer");
    await view.getByLabel("Role", { exact: true }).fill("Architecture review");
    await view
      .getByLabel("Agent instructions", { exact: true })
      .fill("Inspect boundaries.");
    await view.getByLabel("Available for new runs", { exact: true }).check();
    await view
      .getByRole("button", { name: "Save definition", exact: true })
      .click();
    await browserExpect(
      view.locator(".cf-council-definition-list"),
    ).toContainText("Native reviewer");
    const renamedPath = "CoForge/Agents/Native renamed.md";
    await obsidian.eval(async ({ app }, destination) => {
      const file = app.vault
        .getMarkdownFiles()
        .find((note) => note.path.startsWith("CoForge/Agents/"));
      if (!file) throw new Error("Canonical agent note was not created.");
      await app.vault.process(
        file,
        (current) =>
          current
            .replace(
              "coforge:",
              'custom: "preserve exact" # human metadata\ncoforge:',
            )
            .replace("Inspect boundaries.", "Inspect external boundaries.") +
          "\r\n## Human notes\r\nRetain this text.",
      );
      await app.vault.rename(file, destination);
    }, renamedPath);
    await view
      .getByRole("button", { name: "Refresh definitions", exact: true })
      .click();
    await view
      .locator(".cf-council-definition-list")
      .getByRole("button", { name: /^Native reviewer/ })
      .click();
    await browserExpect(
      view.getByLabel("Agent instructions", { exact: true }),
    ).toHaveValue("Inspect external boundaries.");
    await view
      .getByLabel("Agent instructions", { exact: true })
      .fill("Inspect final boundaries.");
    await view
      .getByRole("button", { name: "Save definition", exact: true })
      .click();
    await browserExpect(
      view
        .getByRole("status")
        .filter({ hasText: "Definition saved for future runs." }),
    ).toBeVisible();
    const agentNote = await obsidian.eval(async ({ app }, path) => {
      const file = app.vault.getFileByPath(path);
      return file ? app.vault.read(file) : null;
    }, renamedPath);
    expect(agentNote).toContain('custom: "preserve exact" # human metadata\n');
    expect(agentNote).toContain("\r\n## Human notes\r\nRetain this text.");
    expect(agentNote).toContain("Inspect final boundaries.");
    await view
      .locator(".cf-council-definition-list")
      .getByRole("button", { name: /^Studio team/ })
      .click();
    await view.getByLabel("Native reviewer", { exact: true }).check();
    await view
      .getByRole("button", { name: "Save definition", exact: true })
      .click();
    await obsidian.eval(async ({ app }) => {
      if (!app.vault.getAbstractFileByPath("CoForge/Requests"))
        await app.vault.createFolder("CoForge/Requests");
      await app.vault.create(
        "CoForge/Requests/Native.md",
        "# Original human source\n\nKeep these bytes.\n",
      );
    });
    await openCouncilPage(view, 'Run monitor');
    await view
      .getByRole("button", {
        name: "Use this desktop for execution",
        exact: true,
      })
      .click();
    await view
      .getByRole("button", { name: "Submit existing note", exact: true })
      .click();
    await view
      .getByRole("combobox", { name: "Project team", exact: true })
      .selectOption({ label: "Studio team" });
    await view
      .getByRole("combobox", { name: "Agent or council", exact: true })
      .selectOption({ label: "Native reviewer · agent" });
    await view
      .getByLabel("Private source note", { exact: true })
      .fill("CoForge/Requests/Native.md");
    await view
      .getByRole("button", { name: "Run preflight", exact: true })
      .click();
    await browserExpect(
      view.getByRole("region", { name: "Invocation preview", exact: true }),
    ).toContainText("1 invocations");
    await view
      .getByText("Test with deterministic simulation", { exact: true })
      .click();
    await view
      .getByLabel("Simulation destination", { exact: true })
      .fill("CoForge/Tests/Native simulation.md");
    await view
      .getByRole("button", { name: "Queue simulation", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Resume Council execution", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Run monitor", exact: true })
      .click();
    await browserExpect(view.locator(".cf-council-runs")).toContainText(
      "completed",
      { timeout: 20000 },
    );
    const result = await obsidian.eval(async ({ app }) => {
      const source = app.vault.getFileByPath("CoForge/Requests/Native.md");
      const target = app.vault.getFileByPath(
        "CoForge/Tests/Native simulation.md",
      );
      return {
        source: source ? await app.vault.read(source) : null,
        result: target ? await app.vault.read(target) : null,
      };
    });
    expect(result.source).toBe(
      "# Original human source\n\nKeep these bytes.\n",
    );
    expect(result.result).toMatch(/simulat/iu);
    expect(result.result).toContain("Original human source");
    await obsidian.screenshot("council-completed-simulation");
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "The Council", exact: true })
      .click();
    await view.getByRole("navigation", { name: "Council workspace", exact: true }).getByRole("button", { name: "Run monitor", exact: true }).click();
    await browserExpect(
      view.getByRole("status").filter({ hasText: "Execution paused" }),
    ).toBeVisible();
    await view
      .getByRole("button", { name: "Run monitor", exact: true })
      .click();
    await browserExpect(view.locator(".cf-council-runs")).toContainText(
      "completed",
    );
    expect(obsidian.errors()).toEqual([]);
  });
});
