import { openWorkflowDisclosure, openWorkflowSettings } from "../support/workflow-navigation";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const width of [1280, 360])
  test(`long workflow keeps step tools and the selected editor reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await openWorkflowSettings(page);
    await openWorkflowDisclosure(page, "Workflow tools");
    const workflow = {
      format: "coforge-workflow/v1",
      revision: "long-workflow",
      name: "Twenty-step review",
      limits: {
        timeoutSeconds: 180,
        maxTurns: 12,
        maxBudgetUsd: 1,
        intervalSeconds: 5,
      },
      steps: Array.from({ length: 20 }, (_, index) => ({
        id: `step-${index + 1}`,
        name: `Review ${index + 1}`,
        instructions: `Prepare a report for step ${index + 1}.`,
        kind: "ai",
        output: "markdown",
        access: "none",
        provider: "demo",
        model: "sonnet",
        automatic: false,
        minVotes: 0,
      })),
    };
    await page
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    await page
      .getByLabel("Or paste workflow JSON", { exact: true })
      .fill(JSON.stringify(workflow));
    await page
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Replace draft", exact: true })
      .click();
    const navigation = page.getByRole("region", {
      name: "Workflow step order",
      exact: true,
    });
    const list = page.getByRole("list", {
      name: "Workflow buckets",
      exact: true,
    });
    await navigation.scrollIntoViewIfNeeded();
    expect(
      await list.evaluate((el) => ({
        scrolls: el.scrollHeight > el.clientHeight,
        bounded: el.clientHeight < 600,
        gutter: getComputedStyle(el).scrollbarGutter,
      })),
    ).toEqual({ scrolls: true, bounded: true, gutter: "auto" });
    const last = list.locator('[data-step-id="step-20"]');
    const choose = last.locator(".cf-workflow-step-select");
    await choose.focus();
    const name = page.getByLabel("Step name", { exact: true });
    await name.evaluate((field, width) => {
      const rect = field.getBoundingClientRect();
      const amount =
        width === 1280
          ? rect.bottom + 24
          : -(window.innerHeight - rect.top + 40);
      const pane = field.closest(".cf-content");
      if (pane && pane.scrollHeight > pane.clientHeight + 1)
        pane.scrollTop += amount;
      else window.scrollBy(0, amount);
    }, width);
    await expect(choose).toBeInViewport();
    expect(
      await name.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      }),
    ).toBe(false);
    await page.keyboard.press("Enter");
    await expect(name).toHaveValue("Review 20");
    await expect(name).toBeInViewport();
    await expect
      .poll(() =>
        name.evaluate((el) => {
          const pane = el.closest(".cf-content")!;
          const field = el.getBoundingClientRect();
          const bounds = pane.getBoundingClientRect();
          return (
            field.top >= Math.max(0, bounds.top) &&
            field.bottom <= Math.min(window.innerHeight, bounds.bottom)
          );
        }),
      )
      .toBe(true);
    expect(
      await page
        .locator(".cf-content")
        .evaluate((el) =>
          Math.max(
            el.scrollTop,
            el.ownerDocument.scrollingElement?.scrollTop ?? 0,
          ),
        ),
    ).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Step list", exact: true }).click();
    await expect(choose).toBeFocused();
    const up = last.getByRole("button", {
      name: "Move Review 20 up",
      exact: true,
    });
    await up.focus();
    await page.keyboard.press("Enter");
    await expect(up).toBeFocused();
    await expect(list.locator('[data-step-id]').nth(18)).toHaveAttribute(
      "data-step-id",
      "step-20",
    );
    await expect(choose).toHaveAttribute("aria-current", "step");
    await openWorkflowDisclosure(page, "Add a step");
    const add = navigation.getByRole("button", {
      name: "Add AI step",
      exact: true,
    });
    await expect(add).toBeInViewport();
    await expect(
      navigation.getByRole("heading", { name: /Buckets/ }),
    ).toBeInViewport();
    await add.click();
    await expect(list.locator('[data-step-id]')).toHaveCount(21);
    await expect(name).toHaveValue("New AI step");
    await page.getByRole("button", { name: "Step list", exact: true }).click();
    await navigation
      .getByRole("button", {
        name: "Remove New AI step from workflow",
        exact: true,
      })
      .click();
    await expect(list.locator('[data-step-id]')).toHaveCount(20);
    expect(
      await page
        .locator(".cf-workflow-settings-page")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".cf-workflow-settings-page")
          .analyze()
      ).violations,
    ).toEqual([]);
    await mkdir("reports/configured-workflows", { recursive: true });
    await page.locator(".cf-workflow-editor-layout").screenshot({
      path: `reports/configured-workflows/long-list-${width}.png`,
    });
  });
