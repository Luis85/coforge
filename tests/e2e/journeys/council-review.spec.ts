import { test, expect } from "@playwright/test";
import { captureCouncil, openCouncilReview } from "../support/council-capture";

for (const theme of ["light", "dark"]) {
  for (const scenario of ["publishing", "unknown", "checkpoint"]) {
    test(`Council ${scenario} recovery remains readable and explicit in ${theme}`, async ({
      page,
    }) => {
      const errors = await openCouncilReview(page, scenario, theme);
      await page
        .getByRole("button", {
          name: "Use this desktop for execution",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Run monitor", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Inspect captured evidence", exact: true })
        .click();
      await page
        .getByText("Export or reassign retained results", { exact: true })
        .click();
      await page
        .getByText("Extend an exhausted execution allowance", { exact: true })
        .click();
      if (scenario === "unknown") {
        await expect(page.locator(".cf-council-runs")).toContainText(
          "attention",
        );
        await page
          .getByRole("button", { name: "Retry eligible action", exact: true })
          .click();
        await expect(page.getByRole("alert")).toContainText("acknowledge");
        await page.getByText("Attempt history", { exact: true }).click();
        await captureCouncil(page, "review-unknown", theme);
        await expect(page.locator(".cf-council-runs")).toContainText(
          "0/6 contributions published",
        );
      } else if (scenario === "publishing") {
        await expect(page.locator(".cf-council-runs")).toContainText(
          "publishing",
        );
        await captureCouncil(page, "review-publication", theme);
        await page
          .getByRole("button", { name: "Repair note publication", exact: true })
          .click();
        await expect(page.locator(".cf-council-runs")).toContainText(
          "1/6 contributions published",
        );
        await expect(
          page
            .getByRole("region", { name: "Captured run evidence", exact: true })
            .locator("article"),
        ).toHaveCount(1);
      } else {
        await expect(page.locator(".cf-council-runs")).toContainText(
          "waiting-human",
        );
        await page
          .getByRole("button", {
            name: "Acknowledge and continue",
            exact: true,
          })
          .click();
        await expect(page.getByRole("alert")).toContainText("required");
        await captureCouncil(page, "review-checkpoint", theme);
        await page
          .getByLabel("I reviewed the complete discussion (required)", {
            exact: true,
          })
          .check();
        await page
          .getByLabel("I selected the proposal to continue (required)", {
            exact: true,
          })
          .check();
        await page
          .getByLabel("Checkpoint decision note", { exact: true })
          .fill(
            "Continue the accessible lantern proposal. Preserve the alternative route as unresolved.",
          );
        await page
          .getByRole("button", {
            name: "Acknowledge and continue",
            exact: true,
          })
          .click();
        await expect(page.locator(".cf-council-runs")).toContainText(
          "completed",
        );
      }
      expect(errors).toEqual([]);
    });
  }
  test(`Council definition drafts, search, dependencies and unavailable providers are clear in ${theme}`, async ({
    page,
  }) => {
    const errors = await openCouncilReview(page, "default", theme);
    await page
      .locator(".cf-council-definition-list")
      .getByRole("button", { name: /^Architect/ })
      .click();
    await page
      .getByLabel("Definition name", { exact: true })
      .fill("Architect unsaved draft");
    await page
      .locator(".cf-council-definition-list")
      .getByRole("button", { name: /^Product designer/ })
      .click();
    await page
      .locator(".cf-council-definition-list")
      .getByRole("button", { name: /^Architect/ })
      .click();
    await expect(
      page.getByLabel("Definition name", { exact: true }),
    ).toHaveValue("Architect unsaved draft");
    await expect(
      page.getByRole("region", {
        name: "Definition dependencies",
        exact: true,
      }),
    ).toContainText("Example design council");
    await expect(
      page.getByRole("option", { name: /Herdr managed Claude/ }),
    ).toHaveAttribute("disabled", "");
    const provider = page.getByRole("combobox", {
      name: "Provider",
      exact: true,
    });
    await provider.focus();
    await provider.press("End");
    await expect(provider).toHaveValue("claude");
    await page
      .getByRole("searchbox", { name: "Search definitions", exact: true })
      .fill("Architect");
    const search = await page
      .getByRole("searchbox", { name: "Search definitions", exact: true })
      .boundingBox();
    const saved = await page
      .locator(".cf-council-definition-list")
      .boundingBox();
    const drafts = await page
      .getByRole("region", { name: "Unsaved definition drafts", exact: true })
      .boundingBox();
    expect(search && saved && drafts).toBeTruthy();
    if (search && saved && drafts) {
      expect(saved.y).toBeGreaterThanOrEqual(search.y + search.height - 1);
      expect(drafts.y).toBeGreaterThanOrEqual(saved.y + saved.height - 1);
    }
    await captureCouncil(page, "review-draft", theme);
    await page
      .getByRole("button", { name: "Discard draft", exact: true })
      .click();
    await expect(
      page.getByLabel("Definition name", { exact: true }),
    ).toHaveValue("Architect");
    expect(errors).toEqual([]);
  });
}
test("a changed saved definition cannot replace the displayed Council preflight during admission", async ({
  page,
}) => {
  await openCouncilReview(page, "default", "light");
  await page
    .getByRole("button", {
      name: "Use this desktop for execution",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Submit and preflight", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run preflight", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Invocation preview", exact: true }),
  ).toContainText("6 invocations");
  await page.getByRole("button", { name: "Definitions", exact: true }).click();
  await page
    .locator(".cf-council-definition-list")
    .getByRole("button", { name: /^Architect/ })
    .click();
  await page
    .getByLabel("Agent instructions", { exact: true })
    .fill("New instructions saved after the earlier preview.");
  await page
    .getByRole("button", { name: "Save definition", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Definition saved for future runs." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit and preflight", exact: true })
    .click();
  await page
    .getByText("Test with deterministic simulation", { exact: true })
    .click();
  await page
    .getByLabel("Simulation destination", { exact: true })
    .fill("CoForge/Tests/Stale preview.md");
  await page
    .getByRole("button", { name: "Queue simulation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Run preflight again");
  await expect(
    page.getByRole("region", { name: "Invocation preview", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Run monitor", exact: true }).click();
  await expect(page.locator(".cf-council-runs > li")).toHaveCount(0);
});
