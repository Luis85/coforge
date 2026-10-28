import { expect, test } from "@playwright/test";

test("keeps disconnected chat setup reachable in a short expanded board pane", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .getByRole("navigation", { name: "CoForge navigation" })
    .getByRole("button", { name: /^Idea board/ })
    .click();
  const root = page.locator(".cf-studio");
  await root.evaluate((element) => {
    element.style.height = "430px";
  });
  await page
    .getByRole("button", { name: "Expand chat panel", exact: true })
    .click();
  const configure = page
    .locator(".cf-workspace-body > .cf-chat-panel")
    .getByRole("button", { name: "Configure Twitch", exact: true });
  const rootBounds = await root.boundingBox();
  const actionBounds = await configure.boundingBox();
  if (!rootBounds || !actionBounds)
    throw new Error("Chat setup geometry is missing.");
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(
    rootBounds.y + rootBounds.height,
  );
  await configure.click();
  await expect(page.locator(".cf-topbar strong")).toHaveText("Stream chat");
});
