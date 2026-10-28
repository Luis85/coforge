import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
function body(content: string) {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
  return frontmatter ? content.slice(frontmatter[0].length) : content;
}
describe("Dedicated project workflow editor in the contained vault", () => {
  test("persists independent step configurations across reload and preserves human note annotations exactly", async ({
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
      .fill("Contained step-agent project");
    await view.getByLabel(/^Project path/).fill("/synthetic/step-agents");
    await view
      .getByLabel("Description", { exact: true })
      .fill("A contained project for independently configured AI steps.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await browserExpect(view.locator(".cf-project-switcher")).toContainText(
      "Contained step-agent project",
    );
    const original = await obsidian.eval(async ({ app }) => {
      const file = app.vault
        .getMarkdownFiles()
        .find((file) => file.path.startsWith("CoForge/Projects/"));
      if (!file) throw new Error("Project note missing");
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["human-annotation"] = "keep";
      });
      await app.vault.process(
        file,
        (content) =>
          content +
          "\r\n## Human project notes\r\nPreserve these script bytes.\r\n",
      );
      return { path: file.path, content: await app.vault.read(file) };
    });
    await view
      .getByRole("button", { name: "Workflow settings", exact: true })
      .first()
      .click();
    await browserExpect(view.locator(".cf-workflow-editor-layout")).toHaveCSS(
      "display",
      "grid",
    );
    await view
      .getByLabel("AI provider", { exact: true })
      .selectOption("claude");
    await view.getByLabel("AI model", { exact: true }).fill("haiku");
    await view
      .locator('[data-step-id="plan"] .cf-workflow-step-select')
      .click();
    await view
      .getByLabel("AI provider", { exact: true })
      .selectOption("claude");
    await view.getByLabel("AI model", { exact: true }).fill("sonnet");
    await view
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await browserExpect(
      view.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    const written = await obsidian.eval(
      ({ app }, path) => app.vault.adapter.read(path),
      original.path,
    );
    expect(written).toContain("workflow-definition:");
    expect(written).toContain("model: haiku");
    expect(written).toContain("model: sonnet");
    expect(written).toContain("human-annotation: keep");
    expect(body(written)).toBe(body(original.content));
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Workflow settings", exact: true })
      .first()
      .click();
    await browserExpect(
      view.getByLabel("AI provider", { exact: true }),
    ).toHaveValue("claude");
    await browserExpect(
      view.getByLabel("AI model", { exact: true }),
    ).toHaveValue("haiku");
    await view.getByLabel("AI model", { exact: true }).fill("sonnet");
    await view.getByLabel("AI provider", { exact: true }).selectOption("demo");
    await view
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await browserExpect(
      view.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    const reset = await obsidian.eval(
      ({ app }, path) => app.vault.adapter.read(path),
      original.path,
    );
    expect(reset).not.toContain("model: haiku");
    expect(reset).toContain("provider: claude");
    expect(reset).toContain("human-annotation: keep");
    expect(body(reset)).toBe(body(original.content));
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Workflow settings", exact: true })
      .first()
      .click();
    await browserExpect(
      view.getByLabel("AI provider", { exact: true }),
    ).toHaveValue("demo");
    await browserExpect(
      view.getByLabel("AI model", { exact: true }),
    ).toHaveValue("sonnet");
    await browserExpect(
      view.getByLabel("AI model", { exact: true }),
    ).toBeDisabled();
    await view
      .locator('[data-step-id="plan"] .cf-workflow-step-select')
      .click();
    await browserExpect(
      view.getByLabel("AI provider", { exact: true }),
    ).toHaveValue("claude");
    await view
      .getByRole("button", { name: "Preview workflow export", exact: true })
      .click();
    await browserExpect(
      view.getByLabel("Workflow export JSON", { exact: true }),
    ).toContainText("claude");
    await view
      .getByRole("button", { name: "Export workflow JSON", exact: true })
      .click();
    const savedPath = view.getByLabel("Saved workflow JSON path", {
      exact: true,
    });
    await browserExpect(savedPath).toHaveValue(/coforge-export-.*\.json$/);
    const exported = await obsidian.eval(
      ({ app }, path) => app.vault.adapter.read(path),
      await savedPath.inputValue(),
    );
    expect(exported).toContain("coforge-workflow/v1");
    expect(exported).not.toContain("/synthetic/step-agents");
    expect(exported).not.toContain("human-annotation");
    await obsidian.screenshot("dedicated-workflow-editor");
    expect(obsidian.errors()).toEqual([]);
  });
});
