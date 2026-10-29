import { describe, expect } from "vitest";
import { expect as browserExpect, type Locator } from "@playwright/test";
import { test } from "./support/obsidian-fixture.ts";
import {
  openWorkflowRuns,
  openWorkflowSettings,
} from "../../../tests/e2e/support/workflow-navigation.ts";

async function library(view: Locator) {
  const result = view.locator(".cf-workflow-template-library");
  if (!(await result.evaluate((element) => element.hasAttribute("open"))))
    await result.locator("summary").first().click();
  return result;
}

describe("Project Markdown workflow output templates in Obsidian", () => {
  test("CRUD preserves authored metadata and a waiting run keeps captured template bytes across edits, deletion and reload", async ({
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
      .fill("Contained template workflow");
    await view.getByLabel(/^Project path/).fill("/synthetic/template-workflow");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Private Markdown templates and captured human checkpoints.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await browserExpect(view.locator(".cf-project-switcher")).toContainText(
      "Contained template workflow",
    );
    await openWorkflowSettings(view);
    let templates = await library(view);
    await templates
      .getByRole("button", { name: "New template", exact: true })
      .click();
    await templates
      .getByLabel("Template name", { exact: true })
      .fill("Decision outline");
    const original =
      "# Decision\n\n## Captured evidence\n\n## Recommended next step";
    await templates
      .getByLabel("Template Markdown", { exact: true })
      .fill(original);
    await templates
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    await browserExpect(
      templates.locator(".cf-workflow-editor-notice"),
    ).toContainText("Template saved.");
    const id = await templates
      .getByLabel("Template library", { exact: true })
      .inputValue();
    const created = await obsidian.eval(async ({ app }, templateId) => {
      const file = app.vault
        .getMarkdownFiles()
        .find(
          (item) =>
            item.path.startsWith("CoForge/Output Templates/") &&
            item.basename === templateId,
        );
      return file
        ? { path: file.path, markdown: await app.vault.read(file) }
        : null;
    }, id);
    expect(created).not.toBeNull();
    expect(created?.path).toMatch(
      /^CoForge\/Output Templates\/CFP-\d+\/[a-zA-Z0-9_-]+\.md$/,
    );
    expect(created?.markdown).toContain("schema: coforge-output-template/v1");
    expect(created?.markdown.endsWith(original)).toBe(true);
    await obsidian.eval(async ({ app }, templateId) => {
      const file = app.vault
        .getMarkdownFiles()
        .find(
          (item) =>
            item.path.startsWith("CoForge/Output Templates/") &&
            item.basename === templateId,
        );
      if (!file) throw new Error("Created Markdown template is missing.");
      await app.vault.process(file, (value) =>
        value.replace(
          "---\n",
          '---\nowner_annotation: "keep exactly" # human\n',
        ),
      );
    }, id);
    await templates
      .getByRole("button", { name: "Refresh templates", exact: true })
      .click();
    await templates
      .getByLabel("Template name", { exact: true })
      .fill("Decision outline renamed");
    await templates
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    await browserExpect(
      templates.locator(".cf-workflow-editor-notice"),
    ).toContainText("Template saved.");
    expect(
      await obsidian.eval(async ({ app }, path) => {
        const file = app.vault.getFileByPath(path);
        return file ? app.vault.read(file) : null;
      }, created!.path),
    ).toContain('owner_annotation: "keep exactly" # human');
    await view.locator(".cf-workflow-tools > summary").click();
    await view
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    await view.getByLabel("Or paste workflow JSON", { exact: true }).fill(
      JSON.stringify({
        format: "coforge-workflow/v1",
        revision: "contained-template",
        name: "Captured answer review",
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
            name: "Approve question",
            instructions: "Read the request before asking an agent.",
          },
          {
            id: "answer",
            kind: "ai",
            name: "Write answer",
            instructions: "Analyze the request.",
            output: "markdown",
            access: "none",
            provider: "demo",
            model: "sonnet",
            automatic: false,
            outputTemplateId: id,
          },
          {
            id: "review",
            kind: "checklist",
            name: "Review answer",
            instructions: "Inspect the result.",
            items: [
              { id: "read", label: "I reviewed the answer", required: true },
            ],
          },
        ],
      }),
    );
    await view
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
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
      .locator(".cf-board-page > .cf-page-heading")
      .getByRole("button", { name: "New request", exact: true })
      .click();
    const dialog = view.getByRole("dialog");
    await dialog
      .getByLabel("The idea", { exact: true })
      .fill("Review the forest bridge");
    await dialog
      .getByLabel("A little more context", { exact: true })
      .fill("Preserve this request and captured answer outline.");
    await dialog
      .getByLabel("Contributor name", { exact: true })
      .fill("Contained streamer");
    await dialog
      .getByRole("button", { name: "Add to the board", exact: true })
      .click();
    const card = view
      .locator(".cf-idea-card")
      .filter({ hasText: "Review the forest bridge" });
    await browserExpect(card).toBeVisible();
    await card.getByRole("button", { name: /^Actions for CF-/ }).click();
    await obsidian.page
      .getByRole("menu")
      .getByRole("menuitem", { name: /Start · Approve question/ })
      .click();
    await browserExpect(
      view.getByRole("region", { name: "Manual workflow step", exact: true }),
    ).toBeVisible();
    await openWorkflowSettings(view);
    templates = await library(view);
    await templates
      .getByLabel("Template library", { exact: true })
      .selectOption(id);
    await templates
      .getByLabel("Template Markdown", { exact: true })
      .fill("# Replacement for future runs");
    await templates
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    await browserExpect(
      templates.locator(".cf-workflow-editor-notice"),
    ).toContainText("Template saved.");
    await templates
      .getByRole("button", { name: "Delete template", exact: true })
      .click();
    await templates
      .getByRole("button", { name: "Delete template file", exact: true })
      .click();
    await browserExpect(
      templates.locator(".cf-workflow-editor-notice"),
    ).toContainText("Template deleted.");
    expect(
      await obsidian.eval(
        ({ app }, path) => app.vault.getFileByPath(path) === null,
        created!.path,
      ),
    ).toBe(true);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await openWorkflowRuns(view);
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
    const run = view.getByRole("region", {
      name: "Request workflow execution",
      exact: true,
    });
    await run
      .getByRole("button", { name: "Run · Write answer", exact: true })
      .click();
    await browserExpect(
      manual.getByRole("heading", { name: "Review answer", exact: true }),
    ).toBeVisible();
    await manual
      .getByLabel("I reviewed the answer · required", { exact: true })
      .check();
    await manual
      .getByRole("button", { name: "Complete checklist step", exact: true })
      .click();
    await browserExpect(run).toContainText(
      "Workflow finished without pending code changes",
    );
    const notes = await obsidian.eval(async ({ app }) =>
      Promise.all(
        app.vault
          .getMarkdownFiles()
          .filter((file) => file.path.startsWith("CoForge/Ideas/"))
          .map((file) => app.vault.read(file)),
      ),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("outputTemplates:");
    expect(notes[0]).toContain("## Captured evidence");
    expect(notes[0]).not.toContain("Replacement for future runs");
    expect(notes[0]).toContain("state: finished");
    await obsidian.screenshot("output-template-captured-run-finished");
    expect(obsidian.errors()).toEqual([]);
  });
});
