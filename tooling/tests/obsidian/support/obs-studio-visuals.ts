import type { Locator } from "@playwright/test";
import type { ObsidianHarness } from "./obsidian-fixture";
import { captureStreamPage } from "./obs-stream-visuals";

/** Public display publication is retained; source authoring and monitoring live in OBS. */
export async function captureObsStudioVisuals(
  obsidian: ObsidianHarness,
  view: Locator,
): Promise<void> {
  await view
    .getByRole("navigation", { name: "Stream studio pages", exact: true })
    .getByRole("button", { name: "Public displays", exact: true })
    .click();
  await captureStreamPage(
    obsidian,
    view,
    "public-overlays",
    ".cf-overlay-composer",
    false,
  );
}
