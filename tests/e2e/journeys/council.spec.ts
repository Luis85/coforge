import { openCouncilPage } from '../support/council-navigation';
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function capture(page: Page, name: string, theme: string) {
  await mkdir("reports/council", { recursive: true });
  const council = page.locator(".cf-council");
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await council.evaluate((element) => ({
        width: element.clientWidth,
        scroll: element.scrollWidth,
      })),
    ).toEqual(
      expect.objectContaining({
        width: expect.any(Number),
        scroll: expect.any(Number),
      }),
    );
    expect(
      await council.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await council.screenshot({
      path: `reports/council/${name}-${theme}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(
    (
      await new AxeBuilder({ page })
        .include(".cf-council")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

const COUNCIL_VISUAL_PHASES = ['definitions', 'preflight', 'monitor', 'workflow', 'workflow-message'] as const;
type CouncilVisualPhase = typeof COUNCIL_VISUAL_PHASES[number];

/** The same visible functional path prepares each bounded visual matrix case. */
async function reachCouncilPhase(page: Page, theme: string, phase: CouncilVisualPhase = 'workflow-message') {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.evaluate((value) => {
    document.body.classList.toggle("theme-light", value === "light");
    document.body.classList.toggle("theme-dark", value === "dark");
  }, theme);
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: "The Council", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore Council example", exact: true })
    .click();
  await openCouncilPage(page, 'Definitions');
  await page
    .locator(".cf-council-definition-list")
    .getByRole("button", { name: /^Example design council/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Council rounds", exact: true }),
  ).toContainText("Opinions");
  await expect(
    page.getByRole("region", { name: "Council rounds", exact: true }),
  ).toContainText("Solutions");
  await expect(page.locator(".cf-council-round")).toHaveCount(2);
  if (phase === 'definitions') return errors;
  await openCouncilPage(page, 'Run monitor');
  await page
    .getByRole("button", {
      name: "Use this desktop for execution",
      exact: true,
    })
    .click();
  await openCouncilPage(page, 'Submit existing note');
  await page
    .getByRole("combobox", { name: "Project team", exact: true })
    .selectOption({ label: "Example studio team" });
  await page
    .getByRole("combobox", { name: "CoWorker or council", exact: true })
    .selectOption({ label: "Example design council · council" });
  await page
    .getByLabel("Private source note", { exact: true })
    .fill("CoForge/Examples/Council proposal.md");
  await page
    .getByRole("button", { name: "Run preflight", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Invocation preview", exact: true }),
  ).toContainText("6 invocations");
  if (phase === 'preflight') return errors;
  await page
    .getByText("Test with deterministic simulation", { exact: true })
    .click();
  await page
    .getByLabel("Simulation destination", { exact: true })
    .fill("CoForge/Tests/Browser trial.md");
  await page
    .getByRole("button", { name: "Queue simulation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume Council execution", exact: true })
    .click();
  await expect(page.locator(".cf-council-runs")).toContainText("completed");
  await expect(page.locator(".cf-council-runs")).toContainText(
    "6/6 steps completed or skipped",
  );
  await expect(
    page.getByRole("region", { name: "Council answers", exact: true }),
  ).toContainText("Simulation");
  if (phase === 'monitor') return errors;
  await openCouncilPage(page, 'Council workflows');
  await expect(
    page.getByLabel("Proposal workflow name", { exact: true }),
  ).toHaveValue("Example council proposal");
  await page
    .getByLabel("Private workflow source note", { exact: true })
    .fill("CoForge/Examples/Council proposal.md");
  await page
    .getByRole("button", { name: "Preflight proposal workflow", exact: true })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Proposal invocation preview",
      exact: true,
    }),
  ).toContainText("6 invocations and 1 human checkpoints");
  if (phase === 'workflow') return errors;
  await page
    .locator(".cf-proposal-step")
    .last()
    .locator("summary")
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Step kind", exact: true })
    .last()
    .selectOption("message");
  await page
    .getByLabel("Logical recipient ID", { exact: true })
    .fill("agent-product");
  await page
    .getByLabel("Message body", { exact: true })
    .fill("Information for the next invocation: {{source}}");
  await expect(
    page.getByRole("combobox", { name: "Message purpose", exact: true }),
  ).toHaveValue("information");
  await expect(
    page.getByRole("region", {
      name: "Proposal invocation preview",
      exact: true,
    }),
  ).toHaveCount(0);
  return errors;
}

for (const theme of ['light', 'dark']) {
  test(`Council browser example exposes complete configuration and isolated six-contribution simulation in ${theme}`, async ({ page }) => {
    const errors = await reachCouncilPhase(page, theme);
    expect(errors).toEqual([]);
  });
  for (const phase of COUNCIL_VISUAL_PHASES) {
    test(`Council ${phase} visual matrix in ${theme}`, async ({ page }) => {
      const errors = await reachCouncilPhase(page, theme, phase);
      await capture(page, phase, theme);
      expect(errors).toEqual([]);
    });
  }
}

test("creates three specialists, a team and a six-invocation council entirely through the UI", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: "The Council", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore Council example", exact: true })
    .click();
    await openCouncilPage(page, 'Definitions');
  const specialists = [
    "UI product reviewer",
    "UI architecture reviewer",
    "UI quality reviewer",
  ];
  for (const name of specialists) {
    await page.getByRole('button', { name: 'CoWorkers', exact: true }).click();
    await page
      .getByRole("button", { name: "Create CoWorker", exact: true })
      .click();
    await page.getByLabel("Definition name", { exact: true }).fill(name);
    await page.getByLabel("Role", { exact: true }).fill(name);
    await page
      .getByLabel("CoWorker instructions", { exact: true })
      .fill(
        `Analyze the proposal as ${name}. State assumptions and tradeoffs.`,
      );
    await page.getByLabel("Available for new runs", { exact: true }).check();
    await page
      .getByRole("button", { name: "Save CoWorker", exact: true })
      .click();
    await expect(page.locator(".cf-coworker-cards")).toContainText(
      name,
    );
  }
  await page.getByRole('button', { name: 'The Council', exact: true }).click();
  await openCouncilPage(page, 'Definitions');
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await page
    .getByLabel("Definition name", { exact: true })
    .fill("UI-only team");
  for (const name of specialists)
    await page.getByLabel(name, { exact: true }).check();
  await page
    .getByRole("button", { name: "Save definition", exact: true })
    .click();
  await expect(page.locator(".cf-council-definition-list")).toContainText(
    "UI-only team",
  );
  await page
    .getByRole("button", { name: "Create council", exact: true })
    .click();
  await page
    .getByLabel("Definition name", { exact: true })
    .fill("UI-only council");
  await page
    .getByRole("combobox", { name: "Owning team", exact: true })
    .selectOption({ label: "UI-only team" });
  for (const name of specialists)
    await page.getByLabel(name, { exact: true }).first().check();
  await page.getByLabel("Available for new runs", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save definition", exact: true })
    .click();
  await expect(page.locator(".cf-council-definition-list")).toContainText(
    "UI-only council",
  );
  await openCouncilPage(page, 'Run monitor');
  await page
    .getByRole("button", {
      name: "Use this desktop for execution",
      exact: true,
    })
    .click();
  await openCouncilPage(page, 'Submit existing note');
  await page
    .getByRole("combobox", { name: "Project team", exact: true })
    .selectOption({ label: "UI-only team" });
  await page
    .getByRole("combobox", { name: "CoWorker or council", exact: true })
    .selectOption({ label: "UI-only council · council" });
  await page
    .getByLabel("Private source note", { exact: true })
    .fill("CoForge/Examples/Council proposal.md");
  await page
    .getByRole("button", { name: "Run preflight", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Invocation preview", exact: true }),
  ).toContainText("6 invocations");
  for (const name of specialists)
    await expect(
      page.getByRole("region", { name: "Invocation preview", exact: true }),
    ).toContainText(name);
  await page
    .getByText("Test with deterministic simulation", { exact: true })
    .click();
  await page
    .getByLabel("Simulation destination", { exact: true })
    .fill("CoForge/Tests/UI-created council.md");
  await page
    .getByRole("button", { name: "Queue simulation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume Council execution", exact: true })
    .click();
  await expect(page.locator(".cf-council-runs")).toContainText("completed");
  await expect(page.locator(".cf-council-runs")).toContainText(
    "6/6 steps completed or skipped",
  );
});
