import { parseYaml, stringifyYaml, type Plugin } from "obsidian";
import type { ViewerNoteStorage } from "../../features/coforge/application/viewer-note-ports";
import type { ViewerNote } from "../../features/coforge/domain/viewer-notes";
import { record } from "../../features/coforge/domain/check";
import { defangProperty } from "../../features/coforge/domain/sanitize";
import { contextEventId } from "../../features/coforge/domain/integrity";
import { splitNote } from "./markdown";
const FOLDER = "CoForge/Viewers";
const OWNED = [
  "type",
  "id",
  "platform",
  "display-name",
  "first-seen",
  "last-seen",
  "registered",
  "registered-at",
  "xp",
  "currency",
  "currency-balance",
  "reputation",
  "rank",
  "tracked-chat-presence-seconds",
  "coforge-blocked",
  "twitch-banned",
  "twitch-muted-until",
];
export class VaultViewerNotes implements ViewerNoteStorage {
  private readonly paths = new Map<string, string>();
  private indexing: Promise<void> | undefined;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly plugin: Plugin) {}
  private async index(): Promise<void> {
    this.indexing ??= (async () => {
      const paths = new Map<string, string>();
      for (const file of this.plugin.app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith(FOLDER + "/"))) {
        const { yaml } = splitNote(await this.plugin.app.vault.read(file));
        if (!yaml) continue;
        const properties = record(parseYaml(yaml));
        if (properties.type !== "coforge-viewer") continue;
        if (
          typeof properties.id !== "string" ||
          !/^twitch:\d+$/.test(properties.id) ||
          paths.has(properties.id)
        )
          throw new Error("Duplicate or invalid viewer identity");
        paths.set(properties.id, file.path);
      }
      this.paths.clear();
      for (const [id, path] of paths) this.paths.set(id, path);
    })();
    try {
      await this.indexing;
    } catch (error) {
      this.indexing = undefined;
      throw error;
    }
  }
  async refreshIndex(): Promise<void> {
    await this.pending;
    this.indexing = undefined;
    await this.index();
  }
  save(profile: ViewerNote): Promise<void> {
    const next = this.pending.then(() => this.write(profile));
    this.pending = next.catch(() => undefined);
    return next;
  }
  private async write(profile: ViewerNote): Promise<void> {
    try {
      await this.index();
      const { vault } = this.plugin.app;
      const properties: Record<string, unknown> = {
        type: "coforge-viewer",
        id: profile.id,
        platform: "twitch",
        "display-name": defangProperty(profile.name),
        "first-seen": profile.firstSeenAt,
        "last-seen": profile.lastSeenAt,
        registered: Boolean(profile.registeredAt),
        ...(profile.registeredAt
          ? { "registered-at": profile.registeredAt }
          : {}),
        xp: profile.xp,
        currency: defangProperty(profile.currency),
        "currency-balance": profile.coins,
        reputation: profile.reputation,
        rank: defangProperty(profile.rank),
        "tracked-chat-presence-seconds": profile.presenceSeconds,
        "coforge-blocked": profile.blocked,
        "twitch-banned": profile.banned,
        ...(profile.mutedUntil
          ? { "twitch-muted-until": profile.mutedUntil }
          : {}),
      };
      let known = this.paths.get(profile.id);
      if (known && !vault.getFileByPath(known)) {
        this.indexing = undefined;
        await this.index();
        known = this.paths.get(profile.id);
        if (!known) throw new Error("Canonical viewer note removed");
      }
      const file = known ? vault.getFileByPath(known) : null;
      if (file)
        await vault.process(file, (current) => {
          const { yaml, body } = splitNote(current);
          const frontmatter = record(parseYaml(yaml ?? ""));
          if (
            frontmatter.type !== "coforge-viewer" ||
            frontmatter.id !== profile.id
          )
            throw new Error("Viewer note identity changed");
          for (const key of OWNED) {
            if (key in properties) frontmatter[key] = properties[key];
            else delete frontmatter[key];
          }
          return `---\n${stringifyYaml(frontmatter)}---\n${body}`;
        });
      else {
        if (known) throw new Error("The canonical viewer note is missing");
        if (!vault.getAbstractFileByPath(FOLDER))
          await vault.createFolder(FOLDER);
        const safe =
          profile.name
            .replace(/[\\/:*?"<>|#^[\]]/g, " ")
            .trim()
            .slice(0, 60) || "Viewer";
        const base = `${FOLDER}/${safe} ${contextEventId(profile.id)}.md`;
        let path = base;
        for (let index = 2; vault.getAbstractFileByPath(path); index++)
          path = base.replace(/\.md$/, ` ${index}.md`);
        await vault.create(
          path,
          `---\n${stringifyYaml(properties)}---\n\n# Viewer profile\n\n## Notes\n\n## Topics and follow-up\n\n`,
        );
        this.paths.set(profile.id, path);
      }
    } catch {
      throw new Error(
        "A private viewer note could not be updated. Check duplicate identities, edited identity properties or vault access. Human annotations were preserved.",
      );
    }
  }
  async open(id: string): Promise<void> {
    await this.refreshIndex();
    const path = this.paths.get(id);
    const file = path ? this.plugin.app.vault.getFileByPath(path) : null;
    if (!file)
      throw new Error(
        "The viewer note is unavailable. Refresh viewer notes and check the vault.",
      );
    await this.plugin.app.workspace.getLeaf("tab").openFile(file);
  }
}
