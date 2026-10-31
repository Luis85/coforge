import { openCouncilPage } from '../support/council-navigation';
import { test, expect } from "@playwright/test";
import { captureCouncil, openCouncilReview } from "../support/council-capture";

for (const theme of ["light", "dark"]) {
  for (const scenario of ["publishing", "unknown", "checkpoint"]) {
    test(`Council ${scenario} recovery remains readable and explicit in ${theme}`, async ({
      page,
    }) => {
      const errors = await openCouncilReview(page, scenario, theme);
      await openCouncilPage(page, 'Run monitor');
      await page
        .getByRole("button", {
          name: "Use this desktop for execution",
          exact: true,
        })
        .click();
      await openCouncilPage(page, 'Run monitor');
      await page
        .getByRole("button", { name: "Inspect captured evidence", exact: true })
        .click();
      if (scenario === 'publishing') await page.getByText('Technical details and recovery', { exact: true }).click();
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
          "0/6 steps completed or skipped",
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
          "1/6 steps completed or skipped",
        );
        await expect(
          page
            .getByRole("region", { name: "Council answers", exact: true })
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
    await page.getByRole('button', { name: 'CoWorkers', exact: true }).click();
    await page
      .locator(".cf-coworker-cards")
      .getByRole("button", { name: /^Edit Architect/ })
      .click();
    await page
      .getByLabel("Definition name", { exact: true })
      .fill("Architect unsaved draft");
    await page
      .locator(".cf-coworker-cards")
      .getByRole("button", { name: /^Edit Product designer/ })
      .click();
    await page
      .locator(".cf-coworker-cards")
      .getByRole("button", { name: /^Edit Architect/ })
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
    await expect(provider).toHaveValue("codex");
    await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('gpt-6.1-sol');
    await expect(page.getByRole('combobox', { name: 'Reasoning effort', exact: true })).toBeEnabled();
    await page
      .getByRole("searchbox", { name: "Search CoWorkers", exact: true })
      .fill("Architect");
    const search = await page
      .getByRole("searchbox", { name: "Search CoWorkers", exact: true })
      .boundingBox();
    const saved = await page
      .locator(".cf-coworker-cards")
      .boundingBox();
    const drafts = await page
      .getByRole("region", { name: "Unsaved CoWorker drafts", exact: true })
      .boundingBox();
    expect(search && saved && drafts).toBeTruthy();
    if (search && saved && drafts) {
      expect(saved.y).toBeGreaterThanOrEqual(search.y + search.height - 1);
      expect(drafts.y).toBeGreaterThanOrEqual(saved.y + saved.height - 1);
    }
    await captureCouncil(page, "review-draft", theme, '.cf-coworkers-page');
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
  await openCouncilPage(page, 'Run monitor');
  await page
    .getByRole("button", {
      name: "Use this desktop for execution",
      exact: true,
    })
    .click();
  await openCouncilPage(page, 'Submit existing note');
  await page
    .getByRole("button", { name: "Run preflight", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Invocation preview", exact: true }),
  ).toContainText("6 invocations");
  await page.getByRole("button", { name: "CoWorkers", exact: true }).click();
  await page
    .locator(".cf-coworker-cards")
    .getByRole("button", { name: /^Edit Architect/ })
    .click();
  await page
    .getByLabel("CoWorker instructions", { exact: true })
    .fill("New instructions saved after the earlier preview.");
  await page
    .getByRole("button", { name: "Save CoWorker", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Definition saved for future runs." }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'The Council', exact: true }).click();
  await openCouncilPage(page, 'Submit existing note');
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
  await openCouncilPage(page, 'Run monitor');
  await expect(page.locator(".cf-council-runs > li")).toHaveCount(0);
});
