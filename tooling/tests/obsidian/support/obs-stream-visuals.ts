import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { expect } from "vitest";
import type { ObsidianHarness } from "./obsidian-fixture";
import { writeEvidence } from "./evidence";

/** Captures retained controls only; OBS never supplies a video screenshot. */
export async function captureStreamPage(
  obsidian: ObsidianHarness,
  view: Locator,
  name: string,
  scope: string,
  accessibility = true,
): Promise<void> {
  await obsidian.page.setViewportSize({ width: 1600, height: 1100 });
  const records = [];
  for (const theme of ["light", "dark"]) {
    for (const width of [1280, 480]) {
      await obsidian.eval(
        (_context, size) => {
          document.body.classList.remove("theme-light", "theme-dark");
          document.body.classList.add(`theme-${size.theme}`);
          const root = document.querySelector(".cf-studio");
          const container = root?.closest("[data-plugin-ui]");
          if (
            !(root instanceof HTMLElement) ||
            !(container instanceof HTMLElement)
          )
            throw new Error("Contained CoForge leaf is unavailable.");
          container.style.width = `${Math.min(size.width, container.parentElement?.clientWidth ?? size.width)}px`;
          root.style.width = "100%";
        },
        { theme, width },
      );
      await view.locator(".cf-content").evaluate((element) => {
        element.scrollTop = 0;
      });
      await obsidian.page.mouse.move(1, 1);
      const overflow = await view
        .locator(".cf-content")
        .evaluate((element) => element.scrollWidth - element.clientWidth);
      const path = join(obsidian.directory, `${name}-${theme}-${width}.png`);
      await view.locator(".cf-studio").screenshot({ path });
      const violations = accessibility
        ? (
            await new AxeBuilder({ page: obsidian.page })
              .setLegacyMode(true)
              .include(scope)
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
              .analyze()
          ).violations
        : [];
      records.push({
        theme,
        width,
        path,
        overflow,
        accessibility: accessibility ? "scanned" : "not-run",
        violations,
      });
    }
  }
  await writeEvidence(obsidian.directory, `${name}-visual-review`, {
    source:
      "Contained Obsidian with loopback simulated OBS; no public broadcast",
    records,
  });
  expect(records.filter((record) => record.overflow > 1)).toEqual([]);
  expect(records.flatMap((record) => record.violations)).toEqual([]);
  await obsidian.eval(() => {
    const root = document.querySelector(".cf-studio");
    const container = root?.closest("[data-plugin-ui]");
    if (root instanceof HTMLElement) root.style.width = "";
    if (container instanceof HTMLElement) container.style.width = "";
  });
}
