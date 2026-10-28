import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";

describe("Native status and chat layout in the contained vault", () => {
  test("keeps compact read-only status and the offline chat actions above an overlapping host bar", async ({
    obsidian,
  }) => {
    await obsidian.page.setViewportSize({ width: 1600, height: 1000 });
    const view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.locator(".cf-project-switcher").click();
    await view
      .getByRole("button", { name: "Add project", exact: true })
      .click();
    await view
      .getByLabel("Project name", { exact: true })
      .fill("Native layout fixture");
    await view.getByLabel(/^Project path/).fill("/synthetic/native-layout");
    await view
      .getByLabel("Description", { exact: true })
      .fill("A contained board for status and disconnected chat layout.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    const expand = view.getByRole("button", {
      name: "Expand chat panel",
      exact: true,
    });
    if (await expand.isVisible()) await expand.click();
    const status = obsidian.page.locator(".coforge-native-statusbar");
    await browserExpect(status).toHaveText("CoForge · Chat offline · idle");
    await browserExpect(status.locator("button, a, [tabindex]")).toHaveCount(0);
    await browserExpect(view.locator(".cf-statusbar")).toHaveCount(0);

    // Reproduce a theme/plugin status bar overlay using the real host element and its measured size.
    const originalStyle = await obsidian.eval(() => {
      const root = document.querySelector(".cf-studio");
      const bar = document.querySelector(".status-bar");
      if (!(root instanceof HTMLElement) || !(bar instanceof HTMLElement))
        throw new Error("Native layout elements are unavailable.");
      const source = bar.getAttribute("style");
      const rootBounds = root.getBoundingClientRect();
      const barBounds = bar.getBoundingClientRect();
      if (barBounds.height <= 0 || barBounds.width <= 0)
        throw new Error("Native status bar is not visible.");
      bar.style.setProperty("position", "fixed");
      bar.style.setProperty("bottom", "auto");
      bar.style.setProperty("top", `${rootBounds.bottom - barBounds.height}px`);
      bar.style.setProperty(
        "right",
        `${document.documentElement.clientWidth - rootBounds.right}px`,
      );
      bar.style.setProperty("z-index", "10000");
      return source;
    });
    try {
      const layout = await obsidian.waitFor(() => {
        const root = document.querySelector(".cf-studio");
        const bar = document.querySelector(".status-bar");
        const button =
          root &&
          Array.from(
            root.querySelectorAll(".cf-chat-compose-area button"),
          ).find((button) => button.textContent?.trim() === "Configure Twitch");
        if (!root || !bar || !button) return null;
        const rootBounds = root.getBoundingClientRect();
        const barBounds = bar.getBoundingClientRect();
        const buttonBounds = button.getBoundingClientRect();
        const inset = Number.parseFloat(
          getComputedStyle(root).getPropertyValue("--cf-host-status-inset"),
        );
        if (!(inset > 0) || buttonBounds.bottom > barBounds.top) return null;
        return {
          inset,
          rootBottom: rootBounds.bottom,
          barTop: barBounds.top,
          barBottom: barBounds.bottom,
          buttonBottom: buttonBounds.bottom,
        };
      });
      expect(layout.inset).toBeGreaterThan(0);
      expect(layout.barTop).toBeLessThan(layout.rootBottom);
      expect(layout.barBottom).toBeGreaterThanOrEqual(layout.rootBottom);
      expect(layout.buttonBottom).toBeLessThanOrEqual(layout.barTop);
      await obsidian.screenshot("offline-chat-native-status-inset");
      await view
        .locator(".cf-chat-compose-area")
        .getByRole("button", { name: "Configure Twitch", exact: true })
        .click();
      await browserExpect(view.locator(".cf-topbar strong")).toHaveText(
        "Stream chat",
      );
      await obsidian.disablePlugin();
      await browserExpect(
        obsidian.page.locator(".coforge-native-statusbar"),
      ).toHaveCount(0);
      expect(obsidian.errors()).toEqual([]);
    } finally {
      await obsidian.eval((_context, source) => {
        const bar = document.querySelector(".status-bar");
        if (bar) {
          if (source === null) bar.removeAttribute("style");
          else bar.setAttribute("style", source);
        }
      }, originalStyle);
    }
  });
});
