// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultFinance } from "../../../infrastructure/coforge/finance-storage";
import { FinanceService } from "../../../features/coforge/application/finance-service";
import { emptyStore } from "./memory-storage";
import { splitNote } from "../../../infrastructure/coforge/markdown";
describe("canonical private finance ledger", () => {
  it("preserves note bytes and unknown properties, rejects stale drafts and publishes only committed entries", async () => {
    const app = new App();
    const kit = createTestApp({ app });
    class TestPlugin extends Plugin {}
    const plugin = new TestPlugin(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      description: "",
      author: "",
    });
    const storage = new VaultFinance(plugin);
    const { store } = await emptyStore();
    const service = new FinanceService(storage, store);
    const events: string[] = [];
    store.subscribeEvents((event) => {
      events.push(event.type);
    });
    const ledger = await service.load();
    const entry = {
      id: "entry",
      kind: "income" as const,
      name: "Stream tips",
      amountCents: 1234,
      date: "2026-10-27",
      category: "Tips",
      streamId: "stream-1",
      cadence: "monthly" as const,
      active: true,
    };
    await service.save(entry, ledger.revision);
    expect(events).toContain("finance-entry-saved");
    const file = app.vault.getFileByPath("CoForge/Finance/Ledger.md")!;
    await app.vault.process(
      file,
      (value) =>
        value.replace(
          "type: coforge-finance",
          "custom: keep\ntype: coforge-finance",
        ) + "\r\nEvidence retained.",
    );
    const current = await service.load();
    const body = splitNote(kit.read(file.path)).body;
    await service.save({ ...entry, amountCents: 2000 }, current.revision);
    expect(splitNote(kit.read(file.path)).body).toBe(body);
    expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toMatchObject({
      custom: "keep",
      currency: "EUR",
    });
    const stale = await service.load();
    await app.vault.process(file, (value) => value + "\nExternal edit.");
    const exact = kit.read(file.path);
    const count = events.filter(
      (code) => code === "finance-entry-saved",
    ).length;
    await expect(
      service.save({ ...entry, name: "Overwrite" }, stale.revision),
    ).rejects.toThrow("changed");
    expect(kit.read(file.path)).toBe(exact);
    expect(
      events.filter((code) => code === "finance-entry-saved"),
    ).toHaveLength(count);
    const refreshed = await service.load();
    await expect(
      service.remove(entry.id, "Wrong entry", refreshed.revision),
    ).rejects.toThrow();
    await service.remove(entry.id, entry.name, refreshed.revision);
    expect((await service.load()).entries).toEqual([]);
  });
});
