import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
describe("Streaming workspace in the contained vault", () => {
  test("opens a fresh native window on each ribbon action and closes every capture on unload", async ({
    obsidian,
  }) => {
    const workbench = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    const mainBefore = await obsidian.eval(({ app }) => {
      const types: string[] = [];
      app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view.containerEl.ownerDocument === document)
          types.push(leaf.view.getViewType());
      });
      return types.sort();
    });
    const ribbon = obsidian.page.getByLabel("Open CoForge Stream - Kanban", {
      exact: true,
    });
    const opened = obsidian.page
      .context()
      .waitForEvent("page", { timeout: 15000 });
    await ribbon.click();
    const firstWindow = await opened;
    await obsidian.waitFor(({ app, pluginId }) => {
      const leaf = app.workspace
        .getLeavesOfType(`${pluginId}-view-stream-kanban`)
        .find((leaf) => leaf.view.containerEl.ownerDocument !== document);
      if (
        !leaf?.view.containerEl.querySelector(".cf-stream-surface") ||
        leaf.view.containerEl.ownerDocument.title !== "CoForge Stream - Kanban"
      )
        return false;
      Reflect.set(
        window,
        "__coforgeTestCaptureDocument",
        leaf.view.containerEl.ownerDocument,
      );
      return true;
    });
    await obsidian.page.bringToFront();
    const openedAgain = obsidian.page
      .context()
      .waitForEvent("page", { timeout: 15000 });
    await ribbon.click();
    const secondWindow = await openedAgain;
    expect(secondWindow).not.toBe(firstWindow);
    const state = await obsidian.waitFor(({ app, pluginId }) => {
      const leaves = app.workspace.getLeavesOfType(
        `${pluginId}-view-stream-kanban`,
      );
      const detached = leaves.filter(
        (leaf) => leaf.view.containerEl.ownerDocument !== document,
      );
      const docs = [
        ...new Set(detached.map((leaf) => leaf.view.containerEl.ownerDocument)),
      ];
      if (
        detached.length !== 2 ||
        docs.length !== 2 ||
        docs.some((doc) => !doc.querySelector(".cf-stream-surface"))
      )
        return null;
      const titles = docs.map((doc) => doc.title).sort();
      if (
        titles[0] !== "CoForge Stream - Kanban" ||
        titles[1] !== "CoForge Stream - Kanban (2)"
      )
        return null;
      const mainTypes: string[] = [];
      app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view.containerEl.ownerDocument === document)
          mainTypes.push(leaf.view.getViewType());
      });
      return {
        titles,
        slots: detached
          .map((leaf) => Reflect.get(leaf.view.getState(), "windowSlot"))
          .sort(),
        public: docs.every((doc) =>
          Boolean(doc.querySelector(".cf-stream-surface")),
        ),
        private: docs.some((doc) => Boolean(doc.querySelector(".cf-sidebar"))),
        nativeStatus: docs.some((doc) =>
          Boolean(doc.querySelector(".coforge-native-statusbar")),
        ),
        mainPublicLeaves: leaves.filter(
          (leaf) => leaf.view.containerEl.ownerDocument === document,
        ).length,
        mainTypes: mainTypes.sort(),
      };
    });
    expect(state).toMatchObject({
      titles: ["CoForge Stream - Kanban", "CoForge Stream - Kanban (2)"],
      slots: [1, 2],
      public: true,
      private: false,
      nativeStatus: false,
      mainPublicLeaves: 0,
      mainTypes: mainBefore,
    });
    await browserExpect(workbench).toBeVisible();
    await browserExpect(firstWindow).toHaveTitle("CoForge Stream - Kanban");
    await browserExpect(secondWindow).toHaveTitle(
      "CoForge Stream - Kanban (2)",
    );
    const retargeted = await obsidian.eval(async ({ app, pluginId }) => {
      const firstDocument: Document | undefined = Reflect.get(
        window,
        "__coforgeTestCaptureDocument",
      );
      const type = `${pluginId}-view-stream-kanban`;
      const leaf = app.workspace
        .getLeavesOfType(type)
        .find(
          (leaf) =>
            leaf.view.containerEl.ownerDocument !== document &&
            leaf.view.containerEl.ownerDocument !== firstDocument,
        );
      if (!leaf) throw new Error("Second capture missing");
      await leaf.setViewState({
        type,
        active: true,
        state: { projectId: "CFP-002" },
      });
      return {
        slot: Reflect.get(leaf.view.getState(), "windowSlot"),
        surface: Reflect.get(leaf.view.getState(), "windowSurface"),
      };
    });
    expect(retargeted).toEqual({ slot: 2, surface: "kanban" });
    await browserExpect(secondWindow).toHaveTitle(
      "CoForge Stream - Kanban (2)",
    );
    await obsidian.eval(async ({ app, pluginId }) => {
      const firstDocument: Document | undefined = Reflect.get(
        window,
        "__coforgeTestCaptureDocument",
      );
      const leaf = app.workspace
        .getLeavesOfType(`${pluginId}-view-stream-kanban`)
        .find((leaf) => leaf.view.containerEl.ownerDocument === firstDocument);
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
    await browserExpect(
      secondWindow.locator(".cf-stream-surface"),
    ).toBeVisible();
    const closed = Promise.all([
      firstWindow.waitForEvent("close", { timeout: 15000 }),
      secondWindow.waitForEvent("close", { timeout: 15000 }),
    ]);
    await obsidian.disablePlugin();
    await closed;
    expect(firstWindow.isClosed()).toBe(true);
    expect(secondWindow.isClosed()).toBe(true);
    expect(obsidian.page.isClosed()).toBe(false);
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
