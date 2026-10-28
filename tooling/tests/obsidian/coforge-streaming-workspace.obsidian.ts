import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
describe("Streaming workspace in the contained vault", () => {
  test("opens fresh styled public tabs in the main workspace and preserves the private workbench", async ({
    obsidian,
  }) => {
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const pages = obsidian.page.context().pages().length;
    const icons: string[] = [];
    for (const [surface, title] of [
      ["kanban", "Kanban"],
      ["chat", "Chat"],
      ["leaderboards", "Leaderboards"],
      ["community", "Community"],
    ]) {
      const ribbon = obsidian.page.getByLabel(
        `Open CoForge Stream - ${title}`,
        { exact: true },
      );
      const markup = await ribbon
        .locator("svg")
        .first()
        .evaluate((el) => el.innerHTML);
      expect(markup.trim()).not.toBe("");
      icons.push(markup);
      await ribbon.click();
      await browserExpect(
        obsidian.page.locator(`.cf-stream-surface-${surface}`),
      ).toBeVisible();
      const rendered = await obsidian.eval(
        ({ app, pluginId }, surface: string) => {
          const leaf = app.workspace.getLeavesOfType(
            `${pluginId}-view-stream-${surface}`,
          )[0];
          const root =
            leaf?.view.containerEl.querySelector<HTMLElement>(
              ".cf-stream-surface",
            );
          if (!leaf || !root) throw new Error("Public surface missing");
          const style = getComputedStyle(root);
          return {
            main: leaf.view.containerEl.ownerDocument === document,
            scoped: Boolean(root.closest(".ps--coforge")),
            background: style.backgroundColor,
            fontSize: style.fontSize,
            interactive: root.querySelectorAll("button,input,textarea,a")
              .length,
            text: root.textContent,
          };
        },
        surface,
      );
      expect(rendered).toMatchObject({
        main: true,
        scoped: true,
        fontSize: "16px",
        interactive: 0,
      });
      expect(rendered.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(rendered.text).toContain("!register");
      expect(rendered.text).not.toContain("PRIVATE_");
    }
    expect(new Set(icons).size).toBe(4);
    await obsidian.page
      .getByLabel("Open CoForge Stream - Kanban", { exact: true })
      .click();
    await obsidian.waitFor(({ app, pluginId }) => {
      const leaves = app.workspace.getLeavesOfType(
        `${pluginId}-view-stream-kanban`,
      );
      return (
        leaves.length === 2 &&
        leaves.every(
          (leaf) =>
            leaf.view.containerEl.ownerDocument === document &&
            Boolean(
              leaf.view.containerEl.querySelector(".cf-stream-surface-kanban"),
            ),
        )
      );
    });
    const state = await obsidian.eval(({ app, pluginId }) => {
      const leaves = app.workspace.getLeavesOfType(
        `${pluginId}-view-stream-kanban`,
      );
      return {
        count: leaves.length,
        allMain: leaves.every(
          (leaf) => leaf.view.containerEl.ownerDocument === document,
        ),
        workbench: app.workspace.getLeavesOfType(
          `${pluginId}-view-project-workbench`,
        ).length,
        grid: getComputedStyle(
          leaves.at(-1)!.view.containerEl.querySelector(".cf-stream-kanban")!,
        ).display,
      };
    });
    expect(state).toEqual({
      count: 2,
      allMain: true,
      workbench: 1,
      grid: "grid",
    });
    expect(obsidian.page.context().pages()).toHaveLength(pages);
    await obsidian.screenshot("public-main-tab-styled");
    expect(obsidian.errors()).toEqual([]);
  });
  test("guards a manually detached public capture and opens later commands in the main workspace", async ({
    obsidian,
  }) => {
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await obsidian.runCommand("open-stream-kanban");
    await browserExpect(
      obsidian.page.locator(".cf-stream-surface-kanban"),
    ).toBeVisible();
    const popup = obsidian.page.context().waitForEvent("page");
    await obsidian.eval(({ app, pluginId }) => {
      const leaf = app.workspace.getLeavesOfType(
        `${pluginId}-view-stream-kanban`,
      )[0];
      if (!leaf) throw new Error("Public tab missing");
      app.workspace.moveLeafToPopout(leaf);
    });
    const capture = await popup;
    await browserExpect(capture).toHaveTitle("CoForge Stream - Kanban");
    await obsidian.eval(({ app, pluginId }) => {
      const leaf = app.workspace.getLeavesOfType(
        `${pluginId}-view-stream-kanban`,
      )[0];
      if (!leaf) throw new Error("Capture missing");
      app.workspace.setActiveLeaf(leaf);
      app.commands.executeCommandById(`${pluginId}:open-stream-chat`);
    });
    await obsidian.waitFor(({ app, pluginId }) =>
      app.workspace
        .getLeavesOfType(`${pluginId}-view-stream-chat`)
        .some((leaf) => leaf.view.containerEl.ownerDocument === document),
    );
    await obsidian.eval(async ({ app, pluginId }) => {
      const leaf = app.workspace.getLeavesOfType(
        `${pluginId}-view-stream-kanban`,
      )[0];
      if (!leaf) throw new Error("Capture missing");
      await leaf.setViewState({ type: "markdown", active: true });
    });
    await browserExpect(capture.locator(".cf-stream-curtain")).toBeVisible();
    await browserExpect(capture).toHaveTitle("CoForge Stream - Kanban");
    const closed = capture.waitForEvent("close");
    await obsidian.disablePlugin();
    await closed;
    expect(obsidian.page.isClosed()).toBe(false);
    await obsidian.enablePlugin();
    expect(obsidian.errors()).toEqual([]);
  });
  test("keeps project prompts and planned scripts in canonical private notes across reload", async ({
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
      .fill("Contained prompt project");
    await view.getByLabel(/^Project path/).fill("/synthetic/project");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Host workflow prompt and schedule checks.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Studio settings", exact: true })
      .click();
    await view
      .getByLabel("Workflow step", { exact: true })
      .selectOption("screen");
    await view
      .getByLabel("Project stage prompt", { exact: true })
      .fill("CONTAINED_POLICY: explain project fit.");
    await view
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await browserExpect(
      view.getByText("Settings saved", { exact: true }),
    ).toBeVisible();
    await view.getByRole("button", { name: "Schedule", exact: true }).click();
    await view
      .getByRole("button", { name: "New stream plan", exact: true })
      .click();
    await view.getByLabel("Plan name", { exact: true }).fill("Contained show");
    await view.getByLabel(/^Start ·/).fill("2026-11-01T20:00");
    await view
      .getByRole("button", { name: "Save stream plan", exact: true })
      .click();
    await browserExpect(
      view.getByRole("region", { name: "Stream script", exact: true }),
    ).toContainText("Storyboard");
    const notes = await obsidian.eval(async ({ app }) => {
      const files = app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith("CoForge/Schedule/"));
      if (files.length !== 1) throw new Error("Plan missing");
      await app.vault.process(
        files[0]!,
        (content) => content + "\r\n# Human script\r\nExact annotations.",
      );
      return {
        script: await app.vault.read(files[0]!),
        projects: await Promise.all(
          app.vault
            .getMarkdownFiles()
            .filter((file) => file.path.startsWith("CoForge/Projects/"))
            .map((file) => app.vault.read(file)),
        ),
        ignored: await app.vault.adapter.read("CoForge/.gitignore"),
      };
    });
    expect(
      notes.projects.some(
        (note) =>
          note.includes("agent-prompt-screen:") &&
          note.includes("CONTAINED_POLICY: explain project fit."),
      ),
    ).toBe(true);
    expect(notes.script).toContain("Human script");
    expect(notes.ignored).toContain("!Public/**");
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.getByRole("button", { name: "Schedule", exact: true }).click();
    await view.getByRole("button", { name: /Contained show/ }).click();
    await browserExpect(
      view.getByRole("region", { name: "Stream script", exact: true }),
    ).toContainText("Exact annotations.");
    await obsidian.screenshot("private-schedule");
    expect(obsidian.errors()).toEqual([]);
  });
});
