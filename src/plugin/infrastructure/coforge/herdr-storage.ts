import type { Plugin } from "obsidian";
import type {
  HerdrSaved,
  HerdrStorage,
} from "../../features/coforge/application/herdr-ports";
import { emptyHerdr } from "../../features/coforge/domain/herdr";
import {
  list,
  oneOf,
  optional,
  shape,
  text,
  boolean,
} from "../../features/coforge/domain/check";
const string = text({ max: 4096 });
const agent = shape({
  paneId: string,
  terminalId: string,
  workspaceId: string,
  agent: string,
  name: string,
  cwd: string,
  status: string,
  ready: boolean,
  sessionRef: string,
});
const savedCheck = shape({
  settings: shape({
    executable: text({ min: 1, max: 1000 }),
    session: text({ min: 1, max: 80 }),
  }),
  records: list(
    shape({
      id: string,
      kind: oneOf([
        "dispatch",
        "workspace-create",
        "agent-start",
        "agent-interrupt",
      ] as const),
      session: string,
      at: string,
      status: oneOf(["pending", "delivered", "uncertain", "reviewed"] as const),
      projectId: string,
      ideaId: optional(string),
      target: optional(agent),
    }),
    { max: 100 },
  ),
});
export class HerdrStateStorage implements HerdrStorage {
  constructor(private readonly plugin: Plugin) {}
  private get path(): string {
    const { app, manifest } = this.plugin;
    return `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-herdr.json`;
  }
  async load(): Promise<HerdrSaved> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      if (!(await adapter.exists(this.path)))
        return { settings: emptyHerdr().settings, records: [] };
      return savedCheck(JSON.parse(await adapter.read(this.path)));
    } catch {
      throw new Error(
        "Herdr settings or recovery records could not be read. The stored file was preserved; check vault access and restore valid settings before reconnecting.",
      );
    }
  }
  async save(value: HerdrSaved): Promise<void> {
    const checked = savedCheck(value);
    try {
      await this.plugin.app.vault.adapter.write(
        this.path,
        JSON.stringify(checked, null, 2),
      );
    } catch {
      throw new Error(
        "Herdr recovery records could not be saved. Check vault access before continuing.",
      );
    }
  }
}
