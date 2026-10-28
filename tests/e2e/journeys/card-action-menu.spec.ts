import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
for (const theme of ["light", "dark"])
  test(`card actions are a scoped floating menu in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
    }, theme);
    await page
      .getByRole("button", { name: /^Idea board/ })
      .first()
      .click();
    const card = page
      .locator(".cf-idea-card")
      .filter({ hasText: "Let us pet the forest foxes" });
    await card.click({ button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const directory = `reports/ui-intent/${process.env.COFORGE_INTENT_CAPTURE || "after"}`;
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: `${directory}/24-card-context-menu-${theme}.png`,
      fullPage: true,
    });
    const presentation = await menu.evaluate((element) => ({
      scoped: Boolean(element.closest(".ps--coforge")),
      background: getComputedStyle(element).backgroundColor,
      position: getComputedStyle(element).position,
      bounds: element.getBoundingClientRect().toJSON(),
      floating: element.closest("[data-reka-popper-content-wrapper]")
        ? getComputedStyle(
            element.closest("[data-reka-popper-content-wrapper]")!,
          ).position
        : "",
    }));
    await writeFile(
      `${directory}/24-card-context-menu-${theme}.json`,
      JSON.stringify(presentation, null, 2),
    );
    expect(presentation.scoped).toBe(true);
    expect(presentation.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(["fixed", "absolute"]).toContain(presentation.floating);
    expect(presentation.bounds.width).toBeLessThanOrEqual(336);
    expect(presentation.bounds.height).toBeGreaterThan(150);
    expect(presentation.bounds.left).toBeGreaterThanOrEqual(8);
    expect(presentation.bounds.top).toBeGreaterThanOrEqual(8);
    expect(presentation.bounds.right).toBeLessThanOrEqual(1272);
    expect(presentation.bounds.bottom).toBeLessThanOrEqual(892);
    await expect(
      menu.getByRole("menuitem", { name: "Copy request ID", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: /Start · Screen/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    const trigger = card.getByRole("button", { name: /^Actions for CF-/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await card.locator(".cf-idea-open").focus();
    await page.keyboard.press("Shift+F10");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await expect(menu).toBeVisible();
    const outside = await page.locator(".cf-topbar").boundingBox();
    await page.mouse.click(
      outside!.x + outside!.width / 2,
      outside!.y + outside!.height / 2,
    );
    await expect(menu).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 900 });
    await trigger.click();
    await expect(menu).toBeVisible();
    const narrow = await menu.boundingBox();
    expect(narrow).not.toBeNull();
    expect(narrow!.x).toBeGreaterThanOrEqual(8);
    expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(352);
    expect(narrow!.y + narrow!.height).toBeLessThanOrEqual(892);
    await page.screenshot({
      path: `${directory}/24-card-ellipsis-menu-${theme}-360.png`,
      fullPage: true,
    });
  });

test("menu explains a step-specific runtime block without dispatching work", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Workflow settings", exact: true })
    .click();
  await page.getByLabel("AI provider", { exact: true }).selectOption("claude");
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await expect(
    page.getByText(
      "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Idea board/ })
    .first()
    .click();
  const card = page
    .locator(".cf-idea-card")
    .filter({ hasText: "Let us pet the forest foxes" });
  await card.click({ button: "right" });
  const menu = page.getByRole("menu");
  const blocked = menu.getByRole("menuitem", {
    name: /Start · Screen/,
  });
  await expect(blocked).toHaveAttribute("aria-disabled", "true");
  await expect(blocked).toContainText("Claude Code");
  await expect(card).not.toContainText("Agent running");
  await menu
    .getByRole("menuitem", { name: "Copy request ID", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("review actions open the saved increment instead of accepting it from the menu", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: /^Idea board/ })
    .first()
    .click();
  const card = page
    .locator(".cf-idea-card")
    .filter({ hasText: "Remappable movement keys" });
  await card.getByRole("button", { name: /^Actions for CF-/ }).click();
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: "Review increment", exact: true })
    .click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  const dialog = page.locator(".cf-idea-drawer");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Increment", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cf-column-progress")).toContainText(
    "Remappable movement keys",
  );
});
