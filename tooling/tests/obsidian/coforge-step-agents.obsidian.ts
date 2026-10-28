import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";

function body(content: string): string {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
  return frontmatter ? content.slice(frontmatter[0].length) : content;
}

describe("Project step agents in the contained vault", () => {
  test("persists step overrides and reset across reload without changing human project annotations", async ({
    obsidian,
  }) => {
    let view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Studio settings", exact: true })
      .click();
    await browserExpect(
      view.getByRole("heading", { name: "Choose a project", exact: true }),
    ).toBeVisible();
    await view
      .getByRole("button", { name: "Manage projects", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Add project", exact: true })
      .click();
    await view
      .getByLabel("Project name", { exact: true })
      .fill("Contained step-agent project");
    await view.getByLabel(/^Project path/).fill("/synthetic/step-agents");
    await view
      .getByLabel("Description", { exact: true })
      .fill(
        "A contained project for independent workflow provider and model settings.",
      );
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
      if (!file) throw new Error("Contained project note was not created.");
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
      .getByRole("button", { name: "Studio settings", exact: true })
      .click();
    await view
      .getByLabel("Workflow step", { exact: true })
      .selectOption("screen");
    await view
      .getByLabel("Step provider", { exact: true })
      .selectOption("claude");
    await view.getByLabel("Step model", { exact: true }).fill("haiku");
    await view
      .getByLabel("Workflow step", { exact: true })
      .selectOption("plan");
    await view
      .getByLabel("Step provider", { exact: true })
      .selectOption("claude");
    await view.getByLabel("Step model", { exact: true }).fill("sonnet");
    await view
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await browserExpect(
      view.getByText("Settings saved", { exact: true }),
    ).toBeVisible();
    const written = await obsidian.eval(
      ({ app }, path) => app.vault.adapter.read(path),
      original.path,
    );
    expect(written).toMatch(/^agent-provider-screen:\s*['"]?claude['"]?\s*$/m);
    expect(written).toMatch(/^agent-model-screen:\s*['"]?haiku['"]?\s*$/m);
    expect(written).toMatch(/^agent-provider-plan:\s*['"]?claude['"]?\s*$/m);
    expect(written).toMatch(/^agent-model-plan:\s*['"]?sonnet['"]?\s*$/m);
    expect(written).toContain("human-annotation: keep");
    expect(body(written)).toBe(body(original.content));
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Studio settings", exact: true })
      .click();
    await view
      .getByLabel("Workflow step", { exact: true })
      .selectOption("screen");
    await browserExpect(
      view.getByLabel("Step provider", { exact: true }),
    ).toHaveValue("claude");
    await browserExpect(
      view.getByLabel("Step model", { exact: true }),
    ).toHaveValue("haiku");
    await view
      .getByRole("button", {
        name: "Use project defaults for this step",
        exact: true,
      })
      .click();
    await view
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await browserExpect(
      view.getByText("Settings saved", { exact: true }),
    ).toBeVisible();
    const reset = await obsidian.eval(
      ({ app }, path) => app.vault.adapter.read(path),
      original.path,
    );
    expect(reset).not.toMatch(/^agent-provider-screen:/m);
    expect(reset).not.toMatch(/^agent-model-screen:/m);
    expect(reset).toMatch(/^agent-model-plan:\s*['"]?sonnet['"]?\s*$/m);
    expect(reset).toContain("human-annotation: keep");
    expect(body(reset)).toBe(body(original.content));
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Studio settings", exact: true })
      .click();
    await view
      .getByLabel("Workflow step", { exact: true })
      .selectOption("screen");
    await browserExpect(
      view.getByLabel("Step provider", { exact: true }),
    ).toHaveValue("");
    await browserExpect(
      view.getByLabel("Step model", { exact: true }),
    ).toHaveValue("");
    await browserExpect(
      view.getByLabel("Step model", { exact: true }),
    ).toBeDisabled();
    await view
      .getByLabel("Workflow step", { exact: true })
      .selectOption("plan");
    await browserExpect(
      view.getByLabel("Step provider", { exact: true }),
    ).toHaveValue("claude");
    await browserExpect(
      view.getByLabel("Step model", { exact: true }),
    ).toHaveValue("sonnet");
    await obsidian.screenshot("project-step-agents");
    expect(obsidian.errors()).toEqual([]);
  });
});
