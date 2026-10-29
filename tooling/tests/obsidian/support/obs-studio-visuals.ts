import { join } from "node:path";
import { expect as browserExpect, type Locator } from "@playwright/test";
import { expect } from "vitest";
import type { ObsidianHarness } from "./obsidian-fixture";
import { writeEvidence } from "./evidence";

/** One batched native visual pass; OBS imagery is supplied by the loopback protocol fixture. */
export async function captureObsStudioVisuals(
  obsidian: ObsidianHarness,
  view: Locator,
): Promise<void> {
  await obsidian.page.setViewportSize({ width: 1600, height: 1100 });
  const pages = view.getByRole("navigation", {
    name: "Stream studio pages",
    exact: true,
  });
  const records: Array<{
    name: string;
    theme: string;
    width: number;
    path: string;
    overflow: number;
  }> = [];
  for (const size of [
    { name: "desktop-dark", theme: "dark", width: 1280 },
    { name: "desktop-light", theme: "light", width: 1280 },
    { name: "narrow-light", theme: "light", width: 420 },
  ]) {
    await obsidian.eval((_context, size) => {
      document.body.classList.remove("theme-dark", "theme-light");
      document.body.classList.add(`theme-${size.theme}`);
      const root = document.querySelector(".cf-studio");
      if (!(root instanceof HTMLElement))
        throw new Error("Contained CoForge studio is unavailable.");
      const container = root.closest("[data-plugin-ui]");
      if (!(container instanceof HTMLElement))
        throw new Error("Contained leaf sizing container is unavailable.");
      container.style.width = `${Math.min(size.width, container.parentElement?.clientWidth ?? size.width)}px`;
      container.style.height = `${Math.min(930, container.parentElement?.clientHeight ?? 930)}px`;
      root.style.width = "100%";
      root.style.height = "100%";
    }, size);
    const capture = async (name: string, target?: Locator) => {
      if (target)
        await target.evaluate((element) => {
          const scroll = element.closest(".cf-content");
          if (scroll)
            scroll.scrollTop +=
              element.getBoundingClientRect().top -
              scroll.getBoundingClientRect().top -
              16;
        });
      else
        await view.locator(".cf-content").evaluate((element) => {
          element.scrollTop = 0;
        });
      const geometry = await view
        .locator(".cf-content")
        .evaluate((element) => ({
          overflow: element.scrollWidth - element.clientWidth,
          width: element.clientWidth,
        }));
      const path = join(
        obsidian.directory,
        `connected-${size.name}-${name}.png`,
      );
      await view.locator(".cf-studio").screenshot({ path });
      records.push({
        name,
        theme: size.theme,
        width: geometry.width,
        path,
        overflow: geometry.overflow,
      });
    };
    await pages.getByRole("button", { name: "Broadcast", exact: true }).click();
    const desk = view.getByRole("region", {
      name: "Live production desk",
      exact: true,
    });
    await desk
      .getByRole("button", { name: "Refresh monitors", exact: true })
      .click();
    await browserExpect(
      desk.getByAltText("Sampled OBS program scene", { exact: true }),
    ).toBeVisible();
    await capture("live-desk");
    await capture(
      "live-monitors",
      desk.getByRole("heading", { name: "Live desk", exact: true }),
    );
    await pages
      .getByRole("button", { name: "Sources & layouts", exact: true })
      .click();
    const sources = view.getByRole("region", {
      name: "Source properties and layouts",
      exact: true,
    });
    await sources
      .getByRole("button", { name: "Refresh sources", exact: true })
      .click();
    await sources
      .getByLabel(/^Source to edit/)
      .selectOption({ label: "Council public text · Text" });
    await capture(
      "sources",
      sources.getByRole("heading", { name: "Sources & layouts", exact: true }),
    );
    const layout = view.getByRole("region", {
      name: "Scene layout editor",
      exact: true,
    });
    await layout
      .getByRole("button", { name: "Load scene layout", exact: true })
      .click();
    await layout
      .getByRole("button", { name: "Load item transform", exact: true })
      .click();
    await browserExpect(
      layout.getByLabel("X position", { exact: true }),
    ).toBeVisible();
    await capture(
      "layout",
      layout.getByRole("heading", { name: "Scene layout", exact: true }),
    );
    await pages
      .getByRole("button", { name: "Public displays", exact: true })
      .click();
    const overlays = view.getByRole("region", {
      name: "Public OBS text overlay composer",
      exact: true,
    });
    await capture(
      "public-overlays",
      overlays.getByRole("heading", {
        name: "Public text overlays",
        exact: true,
      }),
    );
    await capture(
      "overlay-preview",
      overlays.getByRole("heading", {
        name: "Publish to Council public text",
        exact: true,
      }),
    );
  }
  await writeEvidence(obsidian.directory, "connected-visual-review", {
    source:
      "contained Obsidian with loopback simulated OBS, no Twitch broadcast",
    records,
  });
  expect(records.filter((record) => record.overflow > 1)).toEqual([]);
  await obsidian.eval(() => {
    const root = document.querySelector(".cf-studio");
    if (root instanceof HTMLElement) {
      root.style.width = "";
      root.style.height = "";
      const container = root.closest("[data-plugin-ui]");
      if (container instanceof HTMLElement) {
        container.style.width = "";
        container.style.height = "";
      }
    }
  });
}
