import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';
describe("Configured human workflows in Obsidian", () => {
  test("persists a waiting human step across reload and finishes without an invented code increment", async ({
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
      .fill("Contained human workflow");
    await view.getByLabel(/^Project path/).fill("/synthetic/human-workflow");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Contained manual steps with no external process or agent calls.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await browserExpect(view.locator(".cf-project-switcher")).toContainText(
      "Contained human workflow",
    );
    await view
      .getByRole("button", { name: "Workflow settings", exact: true })
      .first()
      .click();
    await view
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    const definition = {
      format: "coforge-workflow/v1",
      revision: "contained-human",
      name: "Human review",
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
          name: "Review scope",
          instructions: "Read the **request** carefully.",
        },
        {
          id: "check",
          kind: "checklist",
          name: "Finish review",
          instructions: "Confirm the review is complete.",
          items: [
            { id: "read", label: "I reviewed the request", required: true },
          ],
        },
      ],
    };
    await view
      .getByLabel("Or paste workflow JSON", { exact: true })
      .fill(JSON.stringify(definition));
    await view
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await browserExpect(
      view.getByRole("region", {
        name: "Workflow import preview",
        exact: true,
      }),
    ).toContainText("Human review");
    await view
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await browserExpect(
      view.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    await view
      .getByRole("button", { name: /^Idea board/ })
      .first()
      .click();
    await view
      .locator('.cf-board-page > .cf-page-heading')
      .getByRole("button", { name: "New request", exact: true })
      .click();
    const dialog = view.getByRole("dialog");
    await dialog
      .getByLabel("The idea", { exact: true })
      .fill("Review the forest path");
    await dialog
      .getByLabel("A little more context", { exact: true })
      .fill("Preserve this human-authored request body.");
    await dialog
      .getByLabel("Contributor name", { exact: true })
      .fill("Contained streamer");
    await dialog
      .getByRole("button", { name: "Add to the board", exact: true })
      .click();
    const card = view
      .locator(".cf-idea-card")
      .filter({ hasText: "Review the forest path" });
    await browserExpect(card).toBeVisible();
    const original = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      return file ? app.vault.read(file) : null;
    });
    if (original === null) throw new Error('The canonical request note was not written.');
    const originalBody = splitNote(original).body;
    expect(originalBody).toContain('Preserve this human\\-authored request body\\.');
    await card.getByRole("button", { name: /^Actions for CF-/ }).click();
    await obsidian.page
      .getByRole("menu")
      .getByRole("menuitem", { name: /Start · Review scope/ })
      .click();
    await browserExpect(
      view.getByRole("region", { name: "Manual workflow step", exact: true }),
    ).toContainText("Read the request carefully.");
    await browserExpect(
      view.locator(".cf-configured-progress > li").first(),
    ).toHaveCSS("display", "grid");
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Agent workflow", exact: true })
      .click();
    const manual = view.getByRole("region", {
      name: "Manual workflow step",
      exact: true,
    });
    await browserExpect(
      manual.getByRole("button", {
        name: "Approve workflow step",
        exact: true,
      }),
    ).toBeVisible();
    await manual
      .getByRole("button", { name: "Approve workflow step", exact: true })
      .click();
    const complete = manual.getByRole("button", {
      name: "Complete checklist step",
      exact: true,
    });
    await browserExpect(complete).toBeDisabled();
    await manual
      .getByLabel("I reviewed the request · required", { exact: true })
      .check();
    await complete.click();
    await browserExpect(
      view.getByRole("region", {
        name: "Request workflow execution",
        exact: true,
      }),
    ).toContainText("Workflow finished without pending code changes");
    await browserExpect(
      view.getByRole("button", { name: "Review code changes", exact: true }),
    ).toHaveCount(0);
    const notes = await obsidian.eval(async ({ app }) =>
      Promise.all(
        app.vault
          .getMarkdownFiles()
          .filter((file) => file.path.startsWith("CoForge/Ideas/"))
          .map((file) => app.vault.read(file)),
      ),
    );
    expect(notes).toHaveLength(1);
    expect(splitNote(notes[0]!).body).toBe(originalBody);
    expect(notes[0]).toContain("status: succeeded");
    expect(notes[0]).toContain("state: finished");
    expect(notes[0]).not.toMatch(/^increment:/m);
    await browserExpect(obsidian.page.getByText('An OBS interaction is already in progress.', { exact: true })).toHaveCount(0);
    await obsidian.screenshot("configured-human-workflow-finished");
    expect(obsidian.errors()).toEqual([]);
  });
});
