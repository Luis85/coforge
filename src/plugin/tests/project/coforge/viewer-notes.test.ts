// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultViewerNotes } from "../../../infrastructure/coforge/vault-viewer-notes";
import { protectPrivateData } from "../../../infrastructure/coforge/private-data-guard";
import { ViewerNoteRecorder } from "../../../features/coforge/application/viewer-note-recorder";
import { emptyStore, nodeTimers } from "./memory-storage";
import { ingestChat } from "../../../features/coforge/application/chat";
import { splitNote } from "../../../infrastructure/coforge/markdown";
describe("private viewer CRM notes", () => {
  it("keeps unregistered viewers, excludes local simulation and preserves CRM annotations across registration", async () => {
    const app = new App();
    const kit = createTestApp({ app, layoutReady: true });
    class TestPlugin extends Plugin {}
    const plugin = new TestPlugin(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      description: "",
      author: "",
    });
    await protectPrivateData(plugin);
    const { store } = await emptyStore();
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
    });
    await ingestChat(store, {
      username: "Unregistered viewer",
      userId: "456",
      source: "twitch",
      channelId: "123",
      messageId: "hello-1",
      text: "Hello everyone",
    });
    await ingestChat(store, {
      username: "Local simulator",
      text: "Local preview",
    });
    const storage = new VaultViewerNotes(plugin);
    const recorder = new ViewerNoteRecorder(
      store,
      storage,
      nodeTimers(),
      () => {},
    );
    await recorder.refresh();
    const notes = kit.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith("CoForge/Viewers/"));
    expect(notes).toHaveLength(1);
    const file = notes[0]!;
    const initial = kit.read(file.path);
    expect(parseYaml(splitNote(initial).yaml!)).toMatchObject({
      id: "twitch:456",
      registered: false,
    });
    await kit.app.vault.process(
      file,
      (content) =>
        content.replace(
          "type: coforge-viewer",
          "tags: [regular]\ncrm-alias: Private annotation\ntype: coforge-viewer",
        ) + "\r\nHuman CRM notes stay intact.",
    );
    const body = splitNote(kit.read(file.path)).body;
    await ingestChat(store, {
      username: "Renamed viewer",
      userId: "456",
      source: "twitch",
      channelId: "123",
      messageId: "register-1",
      text: "!register",
    });
    await recorder.refresh();
    expect(splitNote(kit.read(file.path)).body).toBe(body);
    expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toMatchObject({
      id: "twitch:456",
      registered: true,
      "display-name": "Renamed viewer",
      "crm-alias": "Private annotation",
      tags: ["regular"],
    });
    expect(kit.read("CoForge/.gitignore")).toContain("!Public/**");
    expect(kit.read(".obsidian/plugins/coforge/.gitignore")).toContain(
      "coforge-*.json",
    );
    await recorder.dispose();
  });
  it("preserves existing ignore rules and is idempotent", async () => {
    const app = new App();
    const kit = createTestApp({
      app,
      files: { "CoForge/.gitignore": "# Human rule\nprivate.txt\n" },
    });
    class TestPlugin extends Plugin {}
    const plugin = new TestPlugin(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      description: "",
      author: "",
    });
    await protectPrivateData(plugin);
    const once = kit.read("CoForge/.gitignore");
    await protectPrivateData(plugin);
    expect(kit.read("CoForge/.gitignore")).toBe(once);
    expect(once.startsWith("# Human rule\nprivate.txt\n")).toBe(true);
  });
});
