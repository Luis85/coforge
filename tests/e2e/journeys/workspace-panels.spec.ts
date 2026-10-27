import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("collapses either panel, reclaims board width and keeps a chat draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Idea board", exact: false })
    .first()
    .click();
  const content = page.locator(".cf-content");
  const initial = await content.evaluate((el) => el.clientWidth);
  await page
    .getByRole("button", { name: "Collapse navigation panel", exact: true })
    .click();
  await expect(page.locator(".cf-sidebar")).toBeHidden();
  expect(await content.evaluate((el) => el.clientWidth)).toBeGreaterThan(
    initial + 150,
  );
  await page
    .getByRole("button", { name: "Expand navigation panel", exact: true })
    .click();
  await page.getByRole("button", { name: "Stream chat", exact: true }).click();
  await page
    .getByRole("button", { name: "Test commands locally", exact: true })
    .click();
  await page
    .getByLabel("Chat message", { exact: true })
    .fill("A draft to keep while rearranging the board");
  await page
    .getByRole("button", { name: "Idea board", exact: false })
    .first()
    .click();
  const draft = page.getByLabel("Chat message", { exact: true });
  await expect(draft).toHaveValue(
    "A draft to keep while rearranging the board",
  );
  await page
    .getByRole("button", { name: "Collapse chat panel", exact: true })
    .click();
  await expect(page.locator(".cf-chat-panel")).toBeHidden();
  expect(await content.evaluate((el) => el.clientWidth)).toBeGreaterThan(
    initial + 200,
  );
  await page
    .getByRole("button", { name: "Expand chat panel", exact: true })
    .click();
  await expect(draft).toHaveValue(
    "A draft to keep while rearranging the board",
  );
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.locator(".cf-chat-panel")).toBeVisible();
  await expect(content).toBeHidden();
  await page
    .getByRole("button", { name: "Collapse chat panel", exact: true })
    .click();
  await expect(content).toBeVisible();
  await expect(page.locator(".cf-statusbar")).toHaveCount(0);
  await mkdir("reports/product-audit", { recursive: true });
  await page.screenshot({
    path: "reports/product-audit/board-narrow-collapsed.png",
    fullPage: true,
  });
});
test("renders viewer context as safe Markdown and returns the request to screening", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByRole("button", { name: "Stream chat", exact: true }).click();
  await page
    .getByRole("button", { name: "Test commands locally", exact: true })
    .click();
  for (const text of [
    "!register",
    "!context CF-101 **Bright flowers** beside the gate, with `seasonal` colors.",
  ]) {
    await page.getByLabel("Chat message", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send chat message", exact: true })
      .click();
    await expect(page.getByLabel("Chat message", { exact: true })).toHaveValue(
      "",
    );
  }
  await page
    .getByRole("button", { name: "Idea board", exact: false })
    .first()
    .click();
  const card = page
    .locator(".cf-idea-card")
    .filter({ hasText: "Let us pet the forest foxes" });
  await card.locator(".cf-idea-open").click();
  await expect(
    page.locator(".cf-request-context .cf-markdown strong"),
  ).toContainText("Bright flowers");
  await expect(page.locator(".cf-request-context code")).toContainText(
    "seasonal",
  );
  await expect(page.locator(".cf-request-context img")).toHaveCount(0);
  await mkdir("reports/product-audit", { recursive: true });
  await page.screenshot({
    path: "reports/product-audit/request-context-markdown.png",
    fullPage: true,
  });
});
