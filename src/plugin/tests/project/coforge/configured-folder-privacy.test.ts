// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp, hostInstance } from "@test/obsidian";
import { protectPrivateData } from "../../../infrastructure/coforge/private-data-guard";
import { PublicSitePublisher } from "../../../infrastructure/coforge/public-site-publisher";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { createSeed } from "../../../features/coforge/domain/seed";
import { nodeTimers, registerTestViewers } from "./memory-storage";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureProcess } from "../../../infrastructure/coforge/process";
const services: StudioService[] = [];
afterEach(async () => {
  for (const service of services.splice(0)) await service.stop();
});
function fixture(files: Record<string, string> = {}) {
  const kit = createTestApp({
    files,
    layoutReady: true,
    configDir: ".custom-config",
  });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(hostInstance(kit.app, App), {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    description: "",
    author: "",
  });
  return { kit, plugin };
}
it("protects an existing custom private folder without changing human ignore rules or note bytes", async () => {
  const human = "# My rules\r\nkeep-local.txt\r\n";
  const body = "# Human note\r\nNothing may rewrite these bytes.\r\n";
  const { kit, plugin } = fixture({
    "Requests/Backlog/.gitignore": human,
    "Requests/Backlog/Human.md": body,
  });
  await protectPrivateData(plugin, {
    ideasFolder: "Requests/Backlog",
    publicFolder: "Website",
  });
  const protectedRules = kit.read("Requests/Backlog/.gitignore");
  expect(protectedRules.startsWith(human)).toBe(true);
  expect(protectedRules).toContain("*\n!.gitignore");
  expect(kit.read("Requests/Backlog/Human.md")).toBe(body);
  await protectPrivateData(plugin, {
    ideasFolder: "Requests/Backlog",
    publicFolder: "Website",
  });
  expect(kit.read("Requests/Backlog/.gitignore")).toBe(protectedRules);
});
it("keeps private protection effective after human negation rules are appended, preserving those human bytes", async () => {
  const { kit, plugin } = fixture();
  const layout = { ideasFolder: "Requests/Backlog", publicFolder: "Website" };
  await protectPrivateData(plugin, layout);
  const path = "Requests/Backlog/.gitignore";
  const human = "# My later rules\r\n!*.md\r\n";
  await plugin.app.vault.adapter.write(path, kit.read(path) + human);
  await protectPrivateData(plugin, layout);
  const repaired = kit.read(path);
  expect(repaired.startsWith(human)).toBe(true);
  expect(repaired.indexOf("# CoForge managed private data")).toBeGreaterThan(
    repaired.indexOf("!*.md"),
  );
  await protectPrivateData(plugin, layout);
  expect(kit.read(path)).toBe(repaired);
});
it("makes newly created custom-folder notes ignored by Git while leaving the actual public export available", async () => {
  const { kit, plugin } = fixture();
  await protectPrivateData(plugin, {
    ideasFolder: "Requests/Backlog",
    publicFolder: "Website",
  });
  const root = await mkdtemp(join(tmpdir(), "coforge-private-folder-test-"));
  try {
    await mkdir(join(root, "Requests", "Backlog"), { recursive: true });
    await mkdir(join(root, "Website"));
    await writeFile(
      join(root, "Requests", "Backlog", ".gitignore"),
      kit.read("Requests/Backlog/.gitignore"),
    );
    await writeFile(
      join(root, "Requests", "Backlog", "Feature.md"),
      "# Private synthetic feature\n",
    );
    await writeFile(join(root, "Website", "board.json"), "{}");
    await captureProcess("git", ["init", "-q"], { cwd: root });
    expect(
      (
        await captureProcess(
          "git",
          [
            "check-ignore",
            "--no-index",
            "Requests/Backlog/Feature.md",
            "Website/board.json",
          ],
          { cwd: root },
        )
      ).trim(),
    ).toBe("Requests/Backlog/Feature.md");
  } finally {
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}, 30000);
it("protects the candidate folder before persisted private writes and rejects conflicting integration edits atomically", async () => {
  const { kit, plugin } = fixture();
  const storage = new VaultStudioStorage(plugin);
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(storage, {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  services.push(studio);
  await studio.start();
  await studio.updateIntegration({
    ideasFolder: "Requests/Backlog",
    publicFolder: "Website",
  });
  expect(kit.read("Requests/Backlog/.gitignore")).toContain(
    "# CoForge managed private data",
  );
  await studio.createProject({
    projectName: "Game",
    projectBrief: "A synthetic community project.",
    projectPath: "/synthetic/game",
  });
  await registerTestViewers(studio.store, [{ username: "River" }]);
  await studio.sendChat("River", "!request CFP-001 Add a community garden");
  const notes = kit.app.vault
    .getMarkdownFiles()
    .filter((file) => file.path.startsWith("Requests/Backlog/"));
  expect(notes).toHaveLength(1);
  const body = kit.read(notes[0]!.path);
  const saved = kit.read(".custom-config/plugins/coforge/coforge-state.json");
  await expect(
    studio.updateIntegration({ publicFolder: "requests" }),
  ).rejects.toThrow("private");
  await expect(
    studio.updateIntegration({ ideasFolder: "Website/Ideas" }),
  ).rejects.toThrow("private");
  expect(kit.read(".custom-config/plugins/coforge/coforge-state.json")).toBe(
    saved,
  );
  expect(kit.read(notes[0]!.path)).toBe(body);
  await new VaultStudioStorage(plugin).load();
  expect(kit.read("Requests/Backlog/.gitignore")).toContain("*\n!.gitignore");
});
it("blocks publication and workflow installation into custom private data before any export is written", async () => {
  const { kit, plugin } = fixture({ "Requests/Backlog/Human.md": "# Keep\n" });
  const publisher = new PublicSitePublisher(plugin, () => ({
    ideasFolder: "Requests/Backlog",
    publicFolder: "Website",
  }));
  await expect(publisher.publish(createSeed(), "Requests")).rejects.toThrow(
    "private",
  );
  await expect(
    publisher.installWorkflow("REQUESTS/Backlog/site"),
  ).rejects.toThrow("private");
  await expect(
    publisher.publish(createSeed(), ".custom-config/Exports"),
  ).rejects.toThrow("private");
  expect(await plugin.app.vault.adapter.exists("Requests/board.json")).toBe(
    false,
  );
  expect(kit.read("Requests/Backlog/Human.md")).toBe("# Keep\n");
});
