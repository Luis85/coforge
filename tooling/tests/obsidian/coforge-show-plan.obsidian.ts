import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect as browserExpect, type Locator } from "@playwright/test";
import { describe, expect } from "vitest";
import { test, type ObsidianHarness } from "./support/obsidian-fixture";
import { ObsProductionSocketServer } from "./support/obs-production-socket";
import { writeEvidence } from "./support/evidence";

async function captureShowPlan(
  obsidian: ObsidianHarness,
  view: Locator,
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
      const overflow = await view
        .locator(".cf-content")
        .evaluate((element) => element.scrollWidth - element.clientWidth);
      const path = join(obsidian.directory, `show-plan-${theme}-${width}.png`);
      await obsidian.page.mouse.move(1, 1);
      await view.locator(".cf-studio").screenshot({ path });
      await view
        .getByRole("region", { name: "Run the selected show cue", exact: true })
        .evaluate((element) => {
          const scroll = element.closest(".cf-content");
          if (scroll)
            scroll.scrollTop +=
              element.getBoundingClientRect().top -
              scroll.getBoundingClientRect().top -
              16;
        });
      const runPath = join(
        obsidian.directory,
        `show-cue-${theme}-${width}.png`,
      );
      await obsidian.page.mouse.move(1, 1);
      await view.locator(".cf-studio").screenshot({ path: runPath });
      const accessibility = await new AxeBuilder({ page: obsidian.page })
        .setLegacyMode(true)
        .include(".cf-production-show")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      records.push({
        theme,
        width,
        overflow,
        path,
        runPath,
        violations: accessibility.violations,
      });
    }
  }
  await writeEvidence(obsidian.directory, "show-plan-visual-review", {
    source: "Contained Obsidian with loopback simulated OBS; no broadcast",
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

describe("Show plan rundown in the contained host", () => {
  test("edits and saves private segments, runs only an explicit saved cue and restores the plan without replay", async ({
    obsidian,
  }) => {
    const server = new ObsProductionSocketServer();
    server.state.scenes = [
      { id: "starting", name: "Starting soon" },
      { id: "development", name: "Development" },
      { id: "brb", name: "BRB" },
    ];
    server.state.program = "starting";
    server.state.preview = "starting";
    await server.start();
    const mutations = () =>
      server.state.requests.filter(
        (request) => !request.type.startsWith("Get"),
      );
    try {
      const type = `${obsidian.pluginId}-view-project-workbench`;
      let view = await obsidian.openView(type);
      let pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      expect(
        (await pages.getByRole("button").allTextContents())
          .slice(0, 2)
          .map((label) => label.trim()),
      ).toEqual(["Broadcast", "Show plan"]);
      await pages.getByRole("button", { name: "Setup", exact: true }).click();
      await view
        .getByRole("button", { name: "Skip setup for now", exact: true })
        .click();
      await view
        .getByLabel("OBS WebSocket URL", { exact: true })
        .fill(server.endpoint);
      await view
        .getByLabel("Connect OBS when CoForge opens", { exact: true })
        .check();
      await view
        .getByRole("button", { name: "Save OBS setup", exact: true })
        .click();
      await browserExpect(
        view.getByText("OBS connection and scenes saved.", { exact: true }),
      ).toBeVisible();
      await pages
        .getByRole("button", { name: "Broadcast", exact: true })
        .click();
      await view
        .getByRole("button", { name: "Connect OBS", exact: true })
        .click();
      await browserExpect(
        view.getByText("OBS connected. Review readiness before going live.", {
          exact: true,
        }),
      ).toBeVisible();
      await pages
        .getByRole("button", { name: "Show plan", exact: true })
        .click();
      let show = view.getByRole("region", {
        name: "Show plans and cues",
        exact: true,
      });
      await show
        .getByRole("button", { name: "Create show plan", exact: true })
        .click();
      await browserExpect(show.getByLabel(/^Target scene/)).toContainText(
        "Development",
      );
      await show
        .getByLabel("Show plan name", { exact: true })
        .fill("Friday community workshop");
      const rundown = show.getByRole("list", {
        name: "Show rundown",
        exact: true,
      });
      await browserExpect(rundown.getByRole("listitem")).toHaveCount(6);
      const development = rundown.getByRole("button", {
        name: /^Development /,
      });
      await development.focus();
      await development.press("Enter");
      await browserExpect(development).toHaveAttribute("aria-current", "step");
      await show.getByLabel(/^Planned duration \(seconds\)/).fill("90");
      await show
        .getByLabel("Private presenter notes", { exact: true })
        .fill("Ask the audience to compare the two prototypes.");
      await show.getByLabel(/^Action to add/).selectOption("marker");
      await show
        .getByLabel("Marker label", { exact: true })
        .fill("Development begins");
      await show
        .getByRole("button", { name: "Add action to cue", exact: true })
        .click();
      await browserExpect(
        show.getByRole("button", { name: "Run selected cue", exact: true }),
      ).toBeDisabled();
      const draftAccessibility = await new AxeBuilder({ page: obsidian.page })
        .include(".cf-production-show")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .setLegacyMode(true)
        .analyze();
      expect(draftAccessibility.violations).toEqual([]);
      await show
        .getByRole("button", { name: "Save show plan", exact: true })
        .click();
      await browserExpect(
        show.getByText("Show plan saved. Saving never runs a cue.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(mutations()).toEqual([]);
      expect(server.state.program).toBe("starting");

      await show
        .getByLabel("Private presenter notes", { exact: true })
        .fill("Unsaved presenter revision");
      await browserExpect(
        show.getByRole("button", { name: "Run selected cue", exact: true }),
      ).toBeDisabled();
      await show
        .getByRole("button", { name: "Discard plan draft", exact: true })
        .click();
      await show
        .getByLabel(/^Segment to edit/)
        .selectOption({ label: "Development" });
      await browserExpect(
        show.getByLabel("Private presenter notes", { exact: true }),
      ).toHaveValue("Ask the audience to compare the two prototypes.");
      await show
        .getByRole("button", { name: "Run selected cue", exact: true })
        .click();
      await expect.poll(() => server.state.program).toBe("development");
      await browserExpect(
        show.getByRole("region", { name: "Latest cue outcome", exact: true }),
      ).toContainText("confirmed");
      await browserExpect(
        show.getByRole("region", {
          name: "Stream moment markers",
          exact: true,
        }),
      ).toContainText("Development begins");
      expect(mutations().map((request) => request.type)).toEqual([
        "SetCurrentProgramScene",
      ]);
      await captureShowPlan(obsidian, view);

      const beforeReload = mutations().length;
      await obsidian.reloadPlugin();
      view = await obsidian.openView(type);
      pages = view.getByRole("navigation", {
        name: "Stream studio pages",
        exact: true,
      });
      await pages
        .getByRole("button", { name: "Show plan", exact: true })
        .click();
      show = view.getByRole("region", {
        name: "Show plans and cues",
        exact: true,
      });
      await show
        .getByLabel(/^Saved show plan/)
        .selectOption({ label: "Friday community workshop" });
      await show
        .getByRole("button", { name: "Load show plan", exact: true })
        .click();
      await show
        .getByLabel(/^Segment to edit/)
        .selectOption({ label: "Development" });
      await browserExpect(
        show.getByLabel("Private presenter notes", { exact: true }),
      ).toHaveValue("Ask the audience to compare the two prototypes.");
      await browserExpect(
        show.getByLabel(/^Planned duration \(seconds\)/),
      ).toHaveValue("90");
      await browserExpect(show).toContainText("Event cues are paused.");
      await browserExpect(
        show.getByRole("region", { name: "Latest cue outcome", exact: true }),
      ).toContainText("confirmed");
      expect(mutations()).toHaveLength(beforeReload);
      expect(server.state.active).toBe(false);
      expect(
        server.state.requests.some(
          (request) =>
            request.type === "StartStream" ||
            request.type === "GetStreamServiceSettings",
        ),
      ).toBe(false);
      expect(obsidian.errors()).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
