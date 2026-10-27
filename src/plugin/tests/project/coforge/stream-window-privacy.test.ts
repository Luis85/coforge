// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  captureWindowBlocked,
  protectStreamWindow,
} from "../../../infrastructure/coforge/stream-window-privacy";
import { flushPromises } from "@vue/test-utils";
import { installObsidianDom } from '@test/obsidian';
describe("dedicated capture window guard", () => {
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
