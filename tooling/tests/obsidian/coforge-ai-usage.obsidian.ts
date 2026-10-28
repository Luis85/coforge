import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture.ts";
describe("AI token analytics in the contained vault", () => {
  test("reads provider counts from the private ledger and leaves Herdr usage unavailable", async ({
    obsidian,
  }) => {
    await obsidian.eval(async ({ app }) => {
      for (const folder of ["CoForge", "CoForge/AI-Costs"])
        if (!app.vault.getAbstractFileByPath(folder))
          await app.vault.createFolder(folder);
      const base = {
        featureId: "CF-901",
        featureTitle: "Contained usage feature",
        projectId: "CFP-001",
        projectName: "Contained project",
        stage: "screen",
        startedAt: "2026-10-28T00:00:00.000Z",
      };
      const tasks = [
        {
          ...base,
          id: "usage-native-one",
          provider: "claude",
          status: "failed",
          reportedUsd: 0.01,
          usageSource: "provider",
          usage: {
            inputTokens: 12,
            outputTokens: 4,
            cacheReadInputTokens: 6,
            cacheCreationInputTokens: 0,
          },
        },
        {
          ...base,
          id: "usage-herdr-two",
          provider: "herdr",
          status: "delivered",
        },
      ];
      await app.vault.create(
        "CoForge/AI-Costs/Ledger.md",
        `---\ntype: coforge-ai-costs\nversion: 1\ncurrency: USD\ntasks: ${JSON.stringify(tasks)}\n---\n\n# Contained usage fixture\n`,
      );
    });
    const view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.getByRole("button", { name: "AI costs", exact: true }).click();
    await view.getByRole("button", { name: "Refresh", exact: true }).click();
    const usage = view.getByRole("region", {
      name: "Token usage",
      exact: true,
    });
    await browserExpect(
      usage
        .locator("dt")
        .filter({ hasText: "Uncached input tokens" })
        .locator("..")
        .locator("dd strong"),
    ).toHaveText("12");
    await browserExpect(
      usage
        .locator("dt")
        .filter({ hasText: "Output tokens" })
        .locator("..")
        .locator("dd strong"),
    ).toHaveText("4");
    await browserExpect(usage).toContainText("1 / 2 tasks reported");
    await browserExpect(usage).toContainText("18");
    const herdr = view.getByRole("row").filter({ hasText: "usage-herdr-two" });
    await browserExpect(herdr.getByRole("cell").nth(4)).toContainText(
      "Unavailable",
    );
    await browserExpect(herdr.getByRole("cell").nth(5)).toContainText(
      "Unavailable",
    );
    await obsidian.screenshot("ai-token-usage");
    expect(obsidian.errors()).toEqual([]);
  });
});
