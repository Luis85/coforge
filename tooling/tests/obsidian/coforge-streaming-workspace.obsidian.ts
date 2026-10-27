import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
describe("Streaming workspace in the contained vault", () => {
  test("opens a stable public popout, masks private panes and closes captures on unload", async ({
    obsidian,
  }) => {
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const opened = obsidian.page
      .context()
      .waitForEvent("page", { timeout: 15000 });
    await obsidian.runCommand("open-stream-kanban");
    const capturedWindow = await opened;
    const state = await obsidian.waitFor(({ app, pluginId }) => {
      const leaf = app.workspace
        .getLeavesOfType(`${pluginId}-view-stream-kanban`)
        .find((leaf) => leaf.view.containerEl.ownerDocument !== document);
      if (!leaf) return null;
      const doc = leaf.view.containerEl.ownerDocument;
      return {
        title: doc.title,
        public: Boolean(doc.querySelector(".cf-stream-surface")),
        private: Boolean(doc.querySelector(".cf-sidebar")),
        nativeStatus: Boolean(doc.querySelector(".coforge-native-statusbar")),
      };
    });
    expect(state).toMatchObject({
      title: "CoForge Stream - Kanban",
      public: true,
      private: false,
      nativeStatus: false,
    });
    await obsidian.eval(async ({ app, pluginId }) => {
      const leaf = app.workspace
        .getLeavesOfType(`${pluginId}-view-stream-kanban`)
        .find((leaf) => leaf.view.containerEl.ownerDocument !== document);
      if (!leaf) throw new Error("Capture missing");
      const doc = leaf.view.containerEl.ownerDocument;
      Reflect.set(window, "__coforgeTestCaptureDocument", doc);
      await leaf.setViewState({ type: "markdown", active: true });
    });
    await obsidian.waitFor(() => {
      const doc: Document | undefined = Reflect.get(
        window,
        "__coforgeTestCaptureDocument",
      );
      return doc?.body.classList.contains("coforge-stream-blocked");
    });
    expect(
      await obsidian.eval(() => {
        const doc: Document | undefined = Reflect.get(
          window,
          "__coforgeTestCaptureDocument",
        );
        return doc?.title;
      }),
    ).toBe("CoForge Stream - Kanban");
    const closed = capturedWindow.waitForEvent("close", { timeout: 15000 });
    await obsidian.disablePlugin();
    await closed;
    expect(capturedWindow.isClosed()).toBe(true);
    expect(
      await obsidian.page.locator(".coforge-native-statusbar").count(),
    ).toBe(0);
    await obsidian.enablePlugin();
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await browserExpect(
      obsidian.page.locator(".coforge-native-statusbar"),
    ).toHaveCount(1);
    await obsidian.reloadPlugin();
    await browserExpect(
      obsidian.page.locator(".coforge-native-statusbar"),
    ).toHaveCount(1);
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
      .getByLabel("Prompt stage", { exact: true })
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
