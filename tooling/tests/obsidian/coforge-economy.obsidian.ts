import { expect as browserExpect } from "@playwright/test";
import { describe, expect } from "vitest";
import { test } from "./support/obsidian-fixture";

describe("Economy in the contained Obsidian host", () => {
  test("saves rules, rejects an unfunded command, captures purchases and a draw, and records manual fulfillment after reload", async ({
    obsidian,
  }) => {
    let view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.getByRole("button", { name: "Economy", exact: true }).click();
    const commandPicker = view.getByRole("region", {
      name: "Stream commands",
      exact: true,
    });
    await commandPicker.getByRole("button", { name: /!help/ }).click();
    await view.getByLabel("Command currency bonus", { exact: true }).fill("10");
    await commandPicker.getByRole("button", { name: /!register/ }).click();
    await view.getByLabel("Command fee", { exact: true }).fill("2");
    await view.getByLabel("Command XP bonus", { exact: true }).fill("3");
    const pages = view.getByRole("navigation", {
      name: "Economy pages",
      exact: true,
    });
    await pages.getByRole("button", { name: "Rewards", exact: true }).click();
    await view
      .getByRole("button", { name: "Add manual perk", exact: true })
      .click();
    await view
      .getByLabel("Reward name", { exact: true })
      .fill("Native song choice");
    await view.getByLabel("Reward purchase price", { exact: true }).fill("3");
    await view
      .getByLabel("Manual perk instructions", { exact: true })
      .fill("The streamer manually chooses an appropriate requested song.");
    const rewardId = await view
      .getByRole("region", { name: "Selected reward", exact: true })
      .locator("code")
      .textContent();
    expect(rewardId).toBeTruthy();
    await pages
      .getByRole("button", { name: "Loot boxes", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Add loot box", exact: true })
      .click();
    await view
      .getByLabel("Loot box name", { exact: true })
      .fill("Native single outcome");
    await view.getByLabel("Loot box purchase price", { exact: true }).fill("1");
    await view
      .getByRole("button", { name: "Add outcome", exact: true })
      .click();
    await view
      .getByRole("combobox", { name: "Outcome reward 1", exact: true })
      .selectOption(rewardId!);
    const boxId = await view
      .getByRole("region", { name: "Selected loot box", exact: true })
      .locator("code")
      .textContent();
    expect(boxId).toBeTruthy();
    await view
      .getByRole("button", { name: "Save Economy rules", exact: true })
      .click();
    await browserExpect(
      view.getByRole("button", { name: "Save Economy rules", exact: true }),
    ).toBeDisabled();
    await browserExpect(view.getByRole('status').filter({ hasText: 'Economy rules saved.' })).toBeVisible();
    await view
      .getByRole("button", { name: "Stream chat", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Test commands locally", exact: true })
      .click();
    await view
      .getByLabel("Simulated viewer name", { exact: true })
      .fill("Native economy viewer");
    const send = async (text: string, accepted = true) => {
      await view.getByLabel("Chat message", { exact: true }).fill(text);
      await view
        .getByRole("button", { name: "Send chat message", exact: true })
        .click();
      await browserExpect(
        view.getByLabel("Chat message", { exact: true }),
      ).toHaveValue(accepted ? "" : text);
    };
    const account = () =>
      obsidian.eval(async ({ app, pluginId }) => {
        const data = JSON.parse(
          await app.vault.adapter.read(
            `${app.vault.configDir}/plugins/${pluginId}/coforge-state.json`,
          ),
        );
        const player = data.population.players.find(
          (item: { id: string }) =>
            item.id === "simulator:native economy viewer",
        );
        return {
          player,
          usages: data.population.economy.usages,
          redemptions: data.population.economy.redemptions,
        };
      });
    await send("!register", false);
    await expect.poll(async () => (await account()).player?.coins).toBe(0);
    expect((await account()).player?.registeredAt).toBeUndefined();
    await send("!help");
    await send("!register");
    await send(`!redeem ${rewardId}`);
    await send(`!odds ${boxId}`);
    await send(`!lootbox ${boxId}`);
    await expect.poll(async () => (await account()).redemptions.length).toBe(2);
    expect((await account()).player).toMatchObject({ coins: 4, xp: 3 });
    expect(
      (await account()).usages.find(
        (item: { command: string }) => item.command === "lootbox",
      ),
    ).toMatchObject({
      cost: 1,
      rolls: [
        { ticket: 0, totalWeight: 1, reward: { name: "Native song choice" } },
      ],
    });
    await obsidian.reloadPlugin();
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view
      .getByRole("button", { name: "Stream chat", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Test commands locally", exact: true })
      .click();
    await view
      .getByLabel("Simulated viewer name", { exact: true })
      .fill("Native economy viewer");
    await send("!register");
    expect((await account()).player).toMatchObject({ coins: 4, xp: 3 });
    await view.getByRole("button", { name: "Economy", exact: true }).click();
    await view
      .getByRole("navigation", { name: "Economy pages", exact: true })
      .getByRole("button", { name: "Fulfillment", exact: true })
      .click();
    await view
      .getByRole("button", {
        name: /^Record fulfillment for Native song choice/,
      })
      .first()
      .click();
    await view
      .getByLabel("Private fulfillment note", { exact: true })
      .fill("Delivered manually in the contained test.");
    await view
      .getByRole("button", { name: "Record as fulfilled", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await account()).redemptions.filter(
            (item: { status: string }) => item.status === "fulfilled",
          ).length,
      )
      .toBe(1);
    await obsidian.reloadPlugin();
    expect(
      (await account()).redemptions.filter(
        (item: { status: string }) => item.status === "fulfilled",
      ),
    ).toHaveLength(1);
    expect(obsidian.errors()).toEqual([]);
    view = await obsidian.openView(
      `${obsidian.pluginId}-view-project-workbench`,
    );
    await view.getByRole("button", { name: "Economy", exact: true }).click();
    await view
      .getByRole("navigation", { name: "Economy pages", exact: true })
      .getByRole("button", { name: "Fulfillment", exact: true })
      .click();
    await view
      .getByRole("combobox", { name: "Fulfillment status", exact: true })
      .selectOption("all");
    await obsidian.screenshot(
      "economy-captured-purchases-and-manual-fulfillment",
    );
  });
});
