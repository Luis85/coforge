import { parseYaml, stringifyYaml, type Plugin, type TFile } from "obsidian";
import type { MusicLibraryPort } from "../../features/coforge/application/music-ports";
import {
  musicFolder,
  musicTrackPath,
  type MusicLibrary,
  type MusicPlaylist,
  type MusicTrack,
} from "../../features/coforge/domain/music";
import { splitNote } from "./markdown";
import { record } from "../../features/coforge/domain/check";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.slice(0, 3000) : fallback;
/** Notes are canonical. The sidecar stores only the chosen folder; refresh never writes MP3 or Markdown bytes. */
export class VaultMusic implements MusicLibraryPort {
  private folder = "CoForge/Music";
  private readonly known = new Map<
    string,
    { path: string; content: string; version: string }
  >();
  constructor(private readonly plugin: Plugin) {}
  private get settingsPath(): string {
    const { manifest, app } = this.plugin;
    return `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-music.json`;
  }
  private async safe<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      throw new Error(
        "Music files could not be updated. Check vault access, refresh the library and review any external edits.",
      );
    }
  }
  async load(): Promise<MusicLibrary> {
    return this.safe(async () => {
      const { vault } = this.plugin.app;
      if (await vault.adapter.exists(this.settingsPath))
        this.folder = musicFolder(
          text(
            record(JSON.parse(await vault.adapter.read(this.settingsPath)))
              .folder,
          ),
        );
      const files = vault
        .getFiles()
        .filter((file) => file.path.startsWith(this.folder + "/"));
      if (files.length > 10000) throw new Error("Oversized library");
      const tracks: MusicTrack[] = [];
      const playlists: MusicPlaylist[] = [];
      let warnings = 0;
      const previous = new Map(this.known); this.known.clear();
      for (const file of files.filter(
        (file) => file.extension.toLowerCase() === "mp3",
      )) {
        let properties: Record<string, unknown> = {};
        const note = vault.getFileByPath(file.path.replace(/\.mp3$/i, ".md"));
        if (note)
          try {
            const { yaml } = splitNote(await vault.read(note));
            properties = yaml ? record(parseYaml(yaml)) : {};
          } catch {
            warnings++;
          }
        tracks.push({
          id: file.path,
          title: text(properties.title, file.basename),
          artist: text(properties.artist),
          license: text(properties.license),
          origin: text(properties.origin),
          attribution: text(properties.attribution),
          note: Boolean(note),
        });
      }
      for (const file of files.filter(
        (file) =>
          file.extension === "md" &&
          file.path.startsWith(this.folder + "/Playlists/"),
      )) {
        try {
          const content = await vault.read(file);
          const { yaml } = splitNote(content);
          if (!yaml) continue;
          const properties = record(parseYaml(yaml));
          if (properties.type !== "coforge-playlist") continue;
          const id = text(properties.id);
          const name = text(properties.name);
          if (
            !/^[a-zA-Z0-9-]{1,100}$/.test(id) ||
            !name.trim() ||
            name.length > 100 ||
            this.known.has(id) ||
            !Array.isArray(properties.tracks) ||
            properties.tracks.length > 500
          )
            throw new Error("Invalid playlist");
          const paths = properties.tracks.map((value) => {
            if (
              typeof value !== "string" ||
              !musicTrackPath(value, this.folder)
            )
              throw new Error("Invalid track");
            return value;
          });
          const old = previous.get(id);
          const version = old?.content === content && old.path === file.path ? old.version : crypto.randomUUID();
          this.known.set(id, { path: file.path, content, version });
          playlists.push({ id, name, tracks: paths, version });
        } catch {
          warnings++;
        }
      }
      return {
        folder: this.folder,
        tracks: tracks.sort((a, b) => a.title.localeCompare(b.title)),
        playlists: playlists.sort((a, b) => a.name.localeCompare(b.name)),
        warnings,
      };
    });
  }
  private async ensure(folder: string): Promise<void> {
    let path = "";
    for (const part of folder.split("/")) {
      path += (path ? "/" : "") + part;
      if (!this.plugin.app.vault.getAbstractFileByPath(path))
        await this.plugin.app.vault.createFolder(path);
    }
  }
  async configure(input: string): Promise<void> {
    return this.safe(async () => {
      const folder = musicFolder(input);
      await this.ensure(folder);
      await this.plugin.app.vault.adapter.write(
        this.settingsPath,
        JSON.stringify({ version: 1, folder }, null, 2),
      );
      this.folder = folder;
    });
  }
  async savePlaylist(playlist: MusicPlaylist): Promise<void> {
    return this.safe(async () => {
      if (
        !playlist.name.trim() ||
        playlist.name.length > 100 ||
        playlist.tracks.length > 500 ||
        playlist.tracks.some((path) => !musicTrackPath(path, this.folder))
      )
        throw new Error("Invalid playlist");
      const { vault } = this.plugin.app;
      const properties = {
        type: "coforge-playlist",
        id: playlist.id || crypto.randomUUID(),
        name: playlist.name.trim(),
        tracks: playlist.tracks,
      };
      if (playlist.id) {
        const known = this.known.get(playlist.id);
        const file = known ? vault.getFileByPath(known.path) : null;
        if (!known || !file || known.version !== playlist.version)
          throw new Error("Stale playlist");
        await vault.process(file, (current) => {
          if (current !== known.content) throw new Error("External edit");
          const { yaml, body } = splitNote(current);
          return `---\n${stringifyYaml({ ...record(parseYaml(yaml ?? "")), ...properties })}---\n${body}`;
        });
      } else {
        await this.ensure(this.folder + "/Playlists");
        await vault.create(
          `${this.folder}/Playlists/${properties.id}.md`,
          `---\n${stringifyYaml(properties)}---\n\n# ${properties.name}\n\nStream playlist.\n`,
        );
      }
    });
  }
  async openMetadata(id: string): Promise<void> {
    return this.safe(async () => {
      const { vault, workspace } = this.plugin.app;
      if (!musicTrackPath(id, this.folder) || !vault.getFileByPath(id))
        throw new Error("Missing track");
      const path = id.replace(/\.mp3$/i, ".md");
      let note: TFile | null = vault.getFileByPath(path);
      if (!note)
        note = await vault.create(
          path,
          `---\n${stringifyYaml({ type: "coforge-music", title: vault.getFileByPath(id)!.basename, artist: "", license: "", origin: "", attribution: "" })}---\n\nRecord the source URL, license terms, required attribution and proof of permission here.\n`,
        );
      await workspace.getLeaf("tab").openFile(note);
    });
  }
}
