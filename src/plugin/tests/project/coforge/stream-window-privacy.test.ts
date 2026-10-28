// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  captureWindowBlocked,
  protectStreamWindow,
} from "../../../infrastructure/coforge/stream-window-privacy";
import { flushPromises } from "@vue/test-utils";
import { installObsidianDom } from "@test/obsidian";
describe("dedicated capture window guard", () => {
  it("uses a safe provisional title until a restored window identity is assigned", async () => {
    const restoreDom = installObsidianDom();
    const doc = document.implementation.createHTMLDocument(
      "PRIVATE_VAULT_TITLE",
    );
    const pane = doc.createElement("section");
    pane.className = "workspace-leaf-content";
    pane.dataset.type = "coforge-view-stream-kanban";
    doc.body.append(pane);
    let title = "CoForge Stream - Opening";
    const release = protectStreamWindow(
      doc,
      () => title,
      new Set(["coforge-view-stream-kanban"]),
      () => {},
    );
    try {
      expect(doc.title).toBe("CoForge Stream - Opening");
      title = "CoForge Stream - Kanban (2)";
      doc.title = title;
      await flushPromises();
      expect(doc.title).toBe("CoForge Stream - Kanban (2)");
      doc.title = "PRIVATE_PROJECT_TITLE";
      await flushPromises();
      expect(doc.title).toBe("CoForge Stream - Kanban (2)");
    } finally {
      release();
      restoreDom();
    }
  });
  it("keeps a stable title and masks private replacement panes until they leave the window", async () => {
    const restoreDom = installObsidianDom();
    const doc = document.implementation.createHTMLDocument(
      "PRIVATE_VAULT_TITLE",
    );
    const pane = doc.createElement("section");
    pane.className = "workspace-leaf-content";
    pane.dataset.type = "coforge-view-stream-kanban";
    doc.body.append(pane);
    const allowed = new Set(["coforge-view-stream-kanban"]);
    let blocked = 0;
    expect(captureWindowBlocked(doc, allowed)).toBe(false);
    const release = protectStreamWindow(
      doc,
      "CoForge Stream - Kanban",
      allowed,
      () => {
        blocked++;
      },
    );
    expect(doc.title).toBe("CoForge Stream - Kanban");
    pane.dataset.type = "markdown";
    await flushPromises();
    expect(doc.body.classList.contains("coforge-stream-blocked")).toBe(true);
    expect(blocked).toBe(1);
    doc.title = "PRIVATE_RENAMED_VAULT";
    await flushPromises();
    expect(doc.title).toBe("CoForge Stream - Kanban");
    pane.dataset.type = "coforge-view-stream-kanban";
    await flushPromises();
    expect(doc.body.classList.contains("coforge-stream-blocked")).toBe(false);
    release();
    expect(doc.querySelector(".cf-stream-curtain")).toBeNull();
    doc.title = "Ordinary host title";
    await flushPromises();
    expect(doc.title).toBe("Ordinary host title");
    restoreDom();
  });
});
