// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultMusic } from "../../../infrastructure/coforge/vault-music";
import { splitNote } from "../../../infrastructure/coforge/markdown";

function kit() {
  const app = new App();
  const test = createTestApp({
    app,
    files: {
      "CoForge/Music/One.mp3": "fixture",
      "CoForge/Music/One.md":
        "---\ntitle: Evening\nlicense: CC0\norigin: https://example.test/music\n---\nLicense evidence.\n",
      "CoForge/Music/Two.mp3": "fixture",
    },
    layoutReady: true,
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
  return { app, test, library: new VaultMusic(plugin) };
}
describe("vault music notes", () => {
  it("discovers MP3 metadata and preserves unrelated frontmatter and exact playlist body bytes", async () => {
    const { test, app, library } = kit();
    const initial = await library.load();
    expect(initial.tracks[0]).toMatchObject({
      title: "Evening",
      license: "CC0",
      note: true,
    });
    await library.savePlaylist({
      id: "",
      name: "Night",
      tracks: [initial.tracks[0]!.id],
    });
    const saved = (await library.load()).playlists[0]!;
    const file = app.vault
      .getMarkdownFiles()
      .find((item) => item.path.includes("/Playlists/"))!;
    await app.vault.process(file, (value) =>
      value
        .replace(
          "type: coforge-playlist",
          "custom: keep\ntype: coforge-playlist",
        )
        .replace("Stream playlist.\n", "My notes.\r\n\r\nUntouched bytes."),
    );
    const refreshed = (await library.load()).playlists[0]!;
    const before = splitNote(test.read(file.path)).body;
    await library.savePlaylist({
      ...refreshed,
      name: "Renamed",
      tracks: [...saved.tracks, "CoForge/Music/Two.mp3"],
    });
    expect(splitNote(test.read(file.path)).body).toBe(before);
    expect(parseYaml(splitNote(test.read(file.path)).yaml!)).toMatchObject({
      custom: "keep",
      id: saved.id,
      name: "Renamed",
    });
    const stale = (await library.load()).playlists[0]!;
    await app.vault.process(file, (value) => value + "\nExternal edit.");
    const exact = test.read(file.path);
    await expect(
      library.savePlaylist({ ...stale, name: "Overwrite" }),
    ).rejects.toThrow("external edits");
    expect(test.read(file.path)).toBe(exact);
  });
  it("rejects escaping folders and creates only the requested companion note", async () => {
    const { library, test } = kit();
    await expect(library.configure("../outside")).rejects.toThrow();
    await library.load();
    await library.openMetadata("CoForge/Music/Two.mp3");
    expect(
      parseYaml(splitNote(test.read("CoForge/Music/Two.md")).yaml!),
    ).toMatchObject({
      type: "coforge-music",
      title: "Two",
      license: "",
      origin: "",
    });
    expect(test.read("CoForge/Music/One.mp3")).toBe("fixture");
  });
});
