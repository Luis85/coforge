import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";

describe("Kanban actions in native Obsidian", () => {
  test("opens a themed vertical overlay inside its owning plugin and supports keyboard dismissal", async ({
    obsidian,
  }) => {
    const view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.locator(".cf-project-switcher").click();
    await view
      .getByRole("button", { name: "Add project", exact: true })
      .click();
    await view
      .getByLabel("Project name", { exact: true })
      .fill("Contained menu project");
    await view.getByLabel(/^Project path/).fill("/synthetic/menu-project");
    await view
      .getByLabel("Description", { exact: true })
      .fill("Native card interaction and menu layout checks.");
    await view
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await view
      .getByRole("button", { name: "New request", exact: true })
      .first()
      .click();
    await view.getByLabel(/^The idea/).fill("A useful menu fixture request");
    await view
      .getByRole("button", { name: "Add to the board", exact: true })
      .click();
    const card = view
      .locator(".cf-idea-card")
      .filter({ hasText: "A useful menu fixture request" });
    await browserExpect(card).toBeVisible();
    await browserExpect(view.locator(".cf-board-decisions")).toHaveCount(0);
    await browserExpect(view.getByRole("tab", { name: /^Needs review/ })).toBeVisible();
    await browserExpect(view.getByRole("tab", { name: /^Flagged/ })).toBeVisible();
    await card.click({ button: "right" });
    const menu = view.locator('.cf-card-menu[role="menu"]');
    await browserExpect(menu).toBeVisible();
    const layout = await menu.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const items = [...element.querySelectorAll('[role="menuitem"]')].map(
        (item) => item.getBoundingClientRect().top,
      );
      return {
        scoped: Boolean(element.closest(".ps--coforge")),
        background: style.backgroundColor,
        width: rect.width,
        fits:
          rect.left >= 0 &&
          rect.right <= element.ownerDocument.documentElement.clientWidth + 1,
        vertical: items.every(
          (top, index) => index === 0 || top > (items[index - 1] ?? -1),
        ),
      };
    });
    expect(layout.scoped).toBe(true);
    expect(layout.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(layout.background).not.toBe("transparent");
    expect(layout.width).toBeGreaterThan(120);
    expect(layout.fits).toBe(true);
    expect(layout.vertical).toBe(true);
    await obsidian.screenshot("kanban-actions-open");
    await obsidian.page.keyboard.press("ArrowDown");
    expect(
      await menu.evaluate((element) =>
        Boolean(
          element.ownerDocument.activeElement?.closest('[role="menuitem"]'),
        ),
      ),
    ).toBe(true);
    await obsidian.page.keyboard.press("Escape");
    await browserExpect(menu).toHaveCount(0);
    await card.getByRole("button", { name: /^Actions for / }).click();
    await browserExpect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /^Open CF-/ }).click();
    await browserExpect(menu).toHaveCount(0);
    expect(obsidian.errors()).toEqual([]);
  });
});
