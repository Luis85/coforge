import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import {
  openWorkflowRuns,
  openWorkflowSettings,
  openWorkflowTemplates,
} from "../support/workflow-navigation";
import { openCouncilPage } from "../support/council-navigation";

async function openLibrary(page: Page) {
  const library = page.locator(".cf-workflow-template-library");
  if (!(await library.isVisible())) await openWorkflowTemplates(page);
  await expect(library).toBeVisible();
  if (!(await library.evaluate((element) => element.hasAttribute("open"))))
    await library.locator("summary").first().click();
  return library;
}

test("Council workflows reuse project templates and require fresh review after template edits", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await openWorkflowSettings(page);
  let library = await openLibrary(page);
  await library
    .getByRole("button", { name: "New template", exact: true })
    .click();
  await library
    .getByLabel("Template name", { exact: true })
    .fill("Council decision");
  await library
    .getByLabel("Template Markdown", { exact: true })
    .fill("# Council decision\n\n## Original supporting evidence");
  await library
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(library.locator(".cf-workflow-editor-notice")).toContainText(
    "Template saved.",
  );
  const id = await library
    .getByLabel("Template library", { exact: true })
    .inputValue();
  await page
    .locator(".cf-sidebar")
    .getByRole("button", { name: "The Council", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore Council example", exact: true })
    .click();
  await openCouncilPage(page, "Council workflows");
  await page
    .getByLabel("Answer / output template", { exact: true })
    .selectOption(id);
  await page
    .getByRole("button", { name: "Save proposal workflow", exact: true })
    .click();
  await page
    .getByLabel("Private workflow source note", { exact: true })
    .fill("CoForge/Examples/Council proposal.md");
  await page
    .getByRole("button", { name: "Preflight proposal workflow", exact: true })
    .click();
  const preview = page.getByRole("region", {
    name: "Proposal invocation preview",
    exact: true,
  });
  await expect(preview).toContainText("6 invocations and 1 human checkpoints");
  await preview
    .getByText("Captured step instructions", { exact: true })
    .click();
  await expect(preview).toContainText("## Original supporting evidence");
  library = await openLibrary(page);
  await library
    .getByLabel("Template library", { exact: true })
    .selectOption(id);
  await library
    .getByLabel("Template Markdown", { exact: true })
    .fill("# Council decision\n\n## Revised supporting evidence");
  await library
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(library.locator(".cf-workflow-editor-notice")).toContainText(
    "Template saved.",
  );
  await expect(preview).toHaveCount(0);
  await page
    .getByRole("button", { name: "Preflight proposal workflow", exact: true })
    .click();
  await preview
    .getByText("Captured step instructions", { exact: true })
    .click();
  await expect(preview).toContainText("## Revised supporting evidence");
  await expect(preview).not.toContainText("## Original supporting evidence");
  await page.getByText("Simulate proposal workflow", { exact: true }).click();
  await page
    .getByLabel("Proposal simulation destination", { exact: true })
    .fill("CoForge/Tests/Captured template review.md");
  await page
    .getByRole("button", { name: "Queue proposal simulation", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /Simulation .* retained/ }),
  ).toBeVisible();
  await mkdir("reports/workflow-output-templates", { recursive: true });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page
      .locator(".cf-council")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page.locator(".cf-council").screenshot({
    path: "reports/workflow-output-templates/proposal-workflow-320.png",
  });
});
async function importWorkflow(page: Page) {
  await openWorkflowSettings(page);
  const transfer = page.locator(".cf-workflow-tools");
  if (!(await transfer.evaluate((element) => element.hasAttribute("open"))))
    await transfer.locator("summary").first().click();
  const button = page.getByRole("button", { name: "Import JSON", exact: true });
  await button.click();
  await page.getByLabel("Or paste workflow JSON", { exact: true }).fill(
    JSON.stringify({
      format: "coforge-workflow/v1",
      revision: "template-review",
      name: "Guided answer review",
      limits: {
        timeoutSeconds: 180,
        maxTurns: 12,
        maxBudgetUsd: 1,
        intervalSeconds: 5,
      },
      steps: [
        {
          id: "scope",
          kind: "approval",
          name: "Approve question",
          instructions: "Read the question before asking an agent.",
        },
        {
          id: "answer",
          kind: "ai",
          name: "Write answer",
          instructions: "Analyze the request and provide an answer.",
          output: "markdown",
          access: "none",
          provider: "demo",
          model: "sonnet",
          automatic: false,
        },
        {
          id: "review",
          kind: "checklist",
          name: "Review answer",
          instructions: "Inspect the answer.",
          items: [
            { id: "read", label: "I reviewed the answer", required: true },
          ],
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replace draft", exact: true })
    .click();
}

for (const theme of ["light", "dark"]) {
  test(`project templates are authored, reused, edited and deleted through the workflow UI in ${theme}`, async ({
    page,
  }) => {
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
    await openWorkflowSettings(page);
    const library = await openLibrary(page);
    await library
      .getByRole("button", { name: "New template", exact: true })
      .click();
    await expect(
      library.getByLabel("Template name", { exact: true }),
    ).toBeFocused();
    await library
      .getByLabel("Template name", { exact: true })
      .fill("Decision report");
    await library
      .getByLabel("Template Markdown", { exact: true })
      .fill("# Decision\n\n## Evidence\n\n## Next steps");
    await library
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    await expect(library.locator(".cf-workflow-editor-notice")).toContainText(
      "Template saved.",
    );
    await expect(
      library.getByLabel("Template Markdown", { exact: true }),
    ).toBeFocused();
    const id = await library
      .getByLabel("Template library", { exact: true })
      .inputValue();
    expect(id).not.toBe("");
    await library
      .getByLabel("Template name", { exact: true })
      .fill("Decision report revised");
    await library
      .getByLabel("Template Markdown", { exact: true })
      .fill("# Decision\n\n## Verified evidence\n\n## Next steps");
    await library
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    await expect(library.locator(".cf-workflow-editor-notice")).toContainText(
      "Template saved.",
    );
    await mkdir("reports/workflow-output-templates", { recursive: true });
    await library.getByText("Preview template", { exact: true }).click();
    await library.screenshot({
      path: `reports/workflow-output-templates/template-library-${theme}.png`,
    });
    await importWorkflow(page);
    const steps = page.getByRole("region", {
      name: "Workflow step order",
      exact: true,
    });
    await openWorkflowSettings(page);
    await steps
      .getByRole("button", { name: /Write answer/ })
      .first()
      .click();
    const picker = page.getByLabel("Answer / output template", { exact: true });
    await picker.selectOption(id);
    await page
      .getByRole("button", { name: "Duplicate Write answer", exact: true })
      .click();
    await expect(picker).toHaveValue(id);
    await page
      .getByRole("button", { name: "Move Write answer copy down", exact: true })
      .click();
    await expect(picker).toHaveValue(id);
    await page
      .getByRole("button", {
        name: "Remove Write answer copy from workflow",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await expect(
      page.getByText(
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.",
        { exact: true },
      ),
    ).toBeVisible();
    await openWorkflowRuns(page, 'CF-101');
    const run = page.getByRole("region", {
      name: "Request workflow execution",
      exact: true,
    });
    await run
      .getByRole("button", { name: "Start · Approve question", exact: true })
      .click();
    const manual = page.getByRole("region", {
      name: "Manual workflow step",
      exact: true,
    });
    await expect(
      manual.getByRole("button", {
        name: "Approve workflow step",
        exact: true,
      }),
    ).toBeVisible();
    await manual
      .getByRole("button", { name: "Approve workflow step", exact: true })
      .click();
    await run
      .getByRole("button", { name: "Run · Write answer", exact: true })
      .click();
    await expect(
      manual.getByRole("heading", { name: "Review answer", exact: true }),
    ).toBeVisible();
    const complete = manual.getByRole("button", {
      name: "Complete checklist step",
      exact: true,
    });
    await expect(complete).toBeDisabled();
    await manual
      .getByLabel("I reviewed the answer · required", { exact: true })
      .check();
    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page
        .locator(".cf-idea-drawer")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    await complete.focus();
    await page.keyboard.press("Enter");
    await expect(run).toContainText(
      "Workflow finished without pending code changes",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await openWorkflowSettings(page);
    await openLibrary(page);
    await library
      .getByLabel("Template library", { exact: true })
      .selectOption(id);
    await expect(
      library.getByLabel("Template Markdown", { exact: true }),
    ).toHaveValue("# Decision\n\n## Verified evidence\n\n## Next steps");
    await expect(
      library.getByRole("region", {
        name: "Saved workflow template references",
        exact: true,
      }),
    ).toContainText("Write answer");
    await library
      .getByRole("button", { name: "Delete template", exact: true })
      .click();
    await expect(
      library.getByRole("button", { name: "Keep template", exact: true }),
    ).toBeFocused();
    await library
      .getByRole("button", { name: "Keep template", exact: true })
      .click();
    await expect(
      library.getByRole("button", { name: "Delete template", exact: true }),
    ).toBeFocused();
    await library
      .getByRole("button", { name: "Delete template", exact: true })
      .click();
    await expect(
      library.getByRole("region", {
        name: "Confirm template deletion",
        exact: true,
      }),
    ).toContainText("Decision report revised");
    await library
      .getByRole("button", { name: "Delete template file", exact: true })
      .click();
    await expect(library.locator(".cf-workflow-editor-notice")).toContainText(
      "Template deleted.",
    );
    await expect(
      library.getByRole("button", { name: "New template", exact: true }),
    ).toBeFocused();
    await openWorkflowSettings(page);
    await steps
      .getByRole("button", { name: /Write answer/ })
      .first()
      .click();
    await expect(picker).toContainText("Unavailable template");
    await picker.selectOption("");
    await page
      .getByRole("button", { name: "Save workflow", exact: true })
      .click();
    await mkdir("reports/workflow-output-templates", { recursive: true });
    for (const width of [1440, 800, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await page
        .locator(".cf-workflow-settings-page")
        .evaluate((root) => {
          const right = root.getBoundingClientRect().right;
          return {
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
          font: getComputedStyle(root).font,
            overflowingElements: [...root.querySelectorAll("*")]
              .filter(
                (element) =>
                  element.getBoundingClientRect().width > 0 &&
                  element.getBoundingClientRect().right > right + 1,
              )
              .map((element) => {
                const style = getComputedStyle(element);
                return {
                  tag: element.tagName,
                  className: element.getAttribute("class"),
                  parentClass: element.parentElement?.getAttribute("class"),
                  width: element.getBoundingClientRect().width,
                  font: style.font,
                  minWidth: style.minWidth,
                  whiteSpace: style.whiteSpace,
                  text: element.textContent?.trim().slice(0, 80),
                };
              }),
          };
        });
      await writeFile(
        `reports/workflow-output-templates/editor-reflow-${theme}-${width}.json`,
        JSON.stringify({ width, theme, ...geometry }, null, 2),
      );
      expect(
        await page
          .locator(".cf-workflow-settings-page")
          .evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
      ).toBe(true);
      await page.locator(".cf-workflow-settings-page").screenshot({
        path: `reports/workflow-output-templates/editor-${theme}-${width}.png`,
      });
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(".cf-workflow-settings-page")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}
