import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const views = [
  ["01-studio", "Stream studio", ".cf-broadcast-page"],
  ["02-statistics", "Statistics", ".cf-statistics-page"],
  ["03-finances", "Finances", ".cf-finance"],
  ["04-ai-costs", "AI costs", ".cf-ai-costs"],
  ["05-schedule", "Schedule", ".cf-stream-schedule-page"],
  ["06-board", "Idea board", ".cf-board-page"],
  ["07-chat", "Stream chat", ".cf-stream-page"],
  ["08-workflow", "Agent workflow", ".cf-workflow-page"],
  ["09-community", "Community", ".cf-community-page"],
  ["10-viewers", "Viewers", ".cf-population-page"],
  ["11-operations", "Operations", ".cf-operations-page"],
  ["12-projects", "Projects", ".cf-projects-page"],
  [
    "13-community-settings",
    "Community settings",
    ".cf-community-settings-page",
  ],
  ["14-project-settings", "Project settings", ".cf-settings-page"],
  ["14b-workflow-settings", "Workflow settings", ".cf-workflow-settings-page"],
] as const;
for (const [step, label, selector] of views) {
  test(`view intent: ${label} remains usable at desktop and narrow widths`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    if (label === "Projects")
      await page.locator(".cf-project-switcher").click();
    else
      await page
        .getByRole("button", {
          name: label === "Idea board" ? /^Idea board/ : label,
          exact: label !== "Idea board",
        })
        .first()
        .click();
    const view = page.locator(selector);
    await expect(view).toBeVisible();
    await expect(view.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(view.locator(".cf-page-heading p").first()).toBeVisible();
    const phase = process.env.COFORGE_INTENT_CAPTURE || "after";
    const directory = `reports/ui-intent/${phase}`;
    await mkdir(directory, { recursive: true });
    const content = await view.innerText();
    await writeFile(
      `${directory}/${step}-notes.json`,
      JSON.stringify(
        {
          step,
          label,
          heading: await view.getByRole("heading", { level: 1 }).innerText(),
          content,
        },
        null,
        2,
      ),
    );
    const reflow: boolean[] = [];
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.body.classList.toggle("theme-light", theme === "light");
        document.body.classList.toggle("theme-dark", theme === "dark");
      }, theme);
      for (const width of [1280, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({
          path: `${directory}/${step}-${theme}-${width}.png`,
          fullPage: true,
        });
        reflow.push(
          await page
            .locator(".cf-content")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
      }
    }
    expect(reflow.every(Boolean)).toBe(true);
  });
}

test("native settings clearly separate vault integration from project configuration", async ({
  page,
}) => {
  await page.goto("/#surface=node-2");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await expect(
    page.getByText("These settings are saved with the plugin", {
      exact: false,
    }),
  ).toBeVisible();
  const directory = `reports/ui-intent/${process.env.COFORGE_INTENT_CAPTURE || "after"}`;
  await mkdir(directory, { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
    }, theme);
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `${directory}/15-native-settings-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test("guided setup gives every preparation step a clear task and safe completion state", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByRole("button", { name: "Guided setup", exact: true }).click();
  const guide = page.getByRole("region", {
    name: "Guided stream setup",
    exact: true,
  });
  await expect(guide).toBeVisible();
  const directory = `reports/ui-intent/${process.env.COFORGE_INTENT_CAPTURE || "after"}`;
  await mkdir(directory, { recursive: true });
  for (let step = 0; step < 5; step++) {
    await guide
      .getByRole("list", { name: "Setup steps" })
      .getByRole("button")
      .nth(step)
      .click();
    await guide.screenshot({
      path: `${directory}/16-setup-step-${step + 1}-desktop.png`,
    });
  }
  await expect(
    guide.getByRole("button", { name: "Finish setup", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 360, height: 900 });
  await guide.screenshot({ path: `${directory}/16-setup-review-narrow.png` });
});

for (const [index, label, id] of [
  ["17", "Stream Kanban", "kanban"],
  ["18", "Stream Chat", "chat"],
  ["19", "Stream Leaderboards", "leaderboards"],
  ["20", "Stream Community", "community"],
]) {
  test(`public display intent: ${label} stays read-only and separate from studio controls`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page
      .getByRole("navigation", { name: "Stream studio pages" })
      .getByRole("button", { name: "Public displays", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Preview ${label}`, exact: true })
      .click();
    const surface = page.locator(`.cf-stream-surface-${id}`);
    await expect(surface).toBeVisible();
    await expect(
      surface.locator("button, textarea, input:not([disabled])"),
    ).toHaveCount(0);
    await expect(surface).not.toContainText("simulator:");
    const directory = `reports/ui-intent/${process.env.COFORGE_INTENT_CAPTURE || "after"}`;
    await mkdir(directory, { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await surface.screenshot({
        path: `${directory}/${index}-public-${id}-${width}.png`,
      });
    }
  });
}

for (const [step, label] of [
  ["21", "Finances"],
  ["22", "AI costs"],
  ["23", "Schedule"],
]) {
  test(`operating view intent: ${label} supports its primary task`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.getByRole("button", { name: label, exact: true }).click();
    if (label === "Finances") {
      await page
        .getByRole("button", { name: "Explore finance example", exact: true })
        .click();
      const form = page.getByRole("region", {
        name: "Finance entry editor",
        exact: true,
      });
      await form
        .getByLabel("Finance description", { exact: true })
        .fill("Stream artwork");
      await form.getByLabel("Amount (EUR)", { exact: true }).fill("25");
      await form
        .getByRole("button", { name: "Save finance entry", exact: true })
        .click();
      await expect(
        page.getByRole("list", { name: "Finance entries", exact: true }),
      ).toContainText("Stream artwork");
    } else if (label === "AI costs") {
      await page
        .getByRole("button", { name: "Explore example costs", exact: true })
        .click();
      await expect(
        page.locator(".cf-ai-features button").filter({ hasText: "CF-002" }),
      ).toContainText("Unavailable");
      await page
        .getByRole("button", {
          name: "Add cost for CF-002 dispatch example-herdr-1",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("form", { name: "Manual task cost", exact: true }),
      ).toBeVisible();
    } else {
      await page
        .getByRole("button", { name: "Explore example schedule", exact: true })
        .click();
      await page
        .getByRole("button", { name: "New stream plan", exact: true })
        .click();
      await page
        .getByLabel("Plan name", { exact: true })
        .fill("Community build night");
      await page.getByLabel(/^Start ·/).fill("2026-11-01T20:00");
      await page
        .getByRole("button", { name: "Save stream plan", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Stream script", exact: true }),
      ).toBeVisible();
    }
    const directory = `reports/ui-intent/${process.env.COFORGE_INTENT_CAPTURE || "after"}`;
    await mkdir(directory, { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `${directory}/${step}-${label.toLowerCase().replace(" ", "-")}-operating-${width}.png`,
        fullPage: true,
      });
    }
    if (label === "AI costs") {
      const table = page.getByRole("region", {
        name: "AI task details",
        exact: true,
      });
      await table.focus();
      const before = await table.evaluate((el) => el.scrollLeft);
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => table.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(before);
    }
  });
}

test("task navigation keeps the board first and settings reachable in a short pane", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  const navigation = page.getByRole("navigation", {
    name: "CoForge navigation",
    exact: true,
  });
  expect(
    await navigation.evaluate(
      (el) =>
        el
          .parentElement!.querySelector(".cf-sidebar-bottom")!
          .getBoundingClientRect().top - el.getBoundingClientRect().bottom,
    ),
  ).toBeLessThanOrEqual(2);
  await expect(navigation.getByRole("button").first()).toHaveText(/Idea board/);
  for (const label of ["Build", "Stream", "Community", "Insights"])
    await expect(
      navigation.getByRole("group", {
        name: `${label} navigation`,
        exact: true,
      }),
    ).toBeVisible();
  await page.locator(".cf-studio").evaluate((el) => {
    el.style.height = "560px";
  });
  for (const label of ["Project settings", "How it works"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    expect(
      await button.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const pane = el.closest(".cf-studio")!.getBoundingClientRect();
        return rect.top >= pane.top && rect.bottom <= pane.bottom;
      }),
    ).toBe(true);
  }
  await navigation
    .getByRole("button", { name: "Operations", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cf-operations-page")).toBeVisible();
  await page.setViewportSize({ width: 800, height: 700 });
  const captions = navigation.locator(".cf-nav-group-label");
  await expect(captions).toHaveCount(4);
  for (let index = 0; index < 4; index++)
    await expect(captions.nth(index)).toBeHidden();
  await expect(navigation.getByRole("button").first()).toHaveAccessibleName(
    /Idea board/,
  );
});

test("an empty viewer directory gives a working path to connect chat", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByRole("button", { name: "Viewers", exact: true }).click();
  const empty = page.getByRole("region", {
    name: "No observed viewers",
    exact: true,
  });
  await expect(empty).toContainText("Connect Twitch");
  await empty
    .getByRole("button", { name: "Open Stream chat", exact: true })
    .click();
  await expect(
    page.locator(".cf-stream-page").getByRole("heading", { level: 1 }),
  ).toHaveText("Stream chat");
});
