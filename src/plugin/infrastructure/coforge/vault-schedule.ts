import { parseYaml, stringifyYaml, type Plugin, type TFile } from "obsidian";
import type { ScheduleStorage } from "../../features/coforge/application/schedule-ports";
import {
  scheduledStream,
  scheduleBody,
  type ScheduleNote,
  type ScheduledStream,
} from "../../features/coforge/domain/schedule";
import { record } from "../../features/coforge/domain/check";
import { splitNote } from "./markdown";
import {
  cleanText,
  defangProperty,
} from "../../features/coforge/domain/sanitize";
const FOLDER = "CoForge/Schedule";
/** The note is canonical; a full-content revision rejects external edits, including script changes. */
export class VaultSchedule implements ScheduleStorage {
  private files = new Map<string, TFile>();
  constructor(private readonly plugin: Plugin) {}
  private parse(content: string): ScheduleNote {
    const { yaml, body } = splitNote(content);
    const props = record(parseYaml(yaml ?? ""));
    if (props.type !== "coforge-scheduled-stream" || props.version !== 1)
      throw new Error("Invalid stream plan");
    const raw = record(props.plan);
    const plan = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        typeof value === "string" ? cleanText(value) : value,
      ]),
    );
    return { plan: scheduledStream(plan), body, revision: content };
  }
  async list(): Promise<ScheduleNote[]> {
    try {
      const files = new Map<string, TFile>();
      const notes: ScheduleNote[] = [];
      for (const file of this.plugin.app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith(FOLDER + "/"))) {
        if (file.stat.size > 2 * 1024 * 1024) throw new Error("Plan too large");
        const content = await this.plugin.app.vault.read(file);
        const props = record(parseYaml(splitNote(content).yaml ?? ""));
        if (props.type !== "coforge-scheduled-stream") continue;
        const note = this.parse(content);
        if (files.has(note.plan.id)) throw new Error("Duplicate plan");
        files.set(note.plan.id, file);
        notes.push(note);
      }
      this.files = files;
      return notes.sort((a, b) =>
        a.plan.startsAt.localeCompare(b.plan.startsAt),
      );
    } catch {
      throw new Error(
        "A stream plan has invalid or duplicate properties. Review the notes in CoForge/Schedule; nothing was replaced.",
      );
    }
  }
  async save(
    input: ScheduledStream,
    expected: string | null,
  ): Promise<ScheduleNote> {
    const plan = scheduledStream(input);
    await this.list();
    const file = this.files.get(plan.id);
    let written = "";
    const stored = Object.fromEntries(
      Object.entries(plan).map(([key, value]) => [
        key,
        typeof value === "string" ? defangProperty(value) : value,
      ]),
    );
    try {
      if (file)
        await this.plugin.app.vault.process(file, (current) => {
          if (current !== expected) throw new Error("Plan changed");
          const { yaml, body } = splitNote(current);
          written = `---\n${stringifyYaml({ ...record(parseYaml(yaml ?? "")), type: "coforge-scheduled-stream", version: 1, plan: stored })}---\n${body}`;
          return written;
        });
      else {
        if (expected !== null) throw new Error("Plan removed");
        for (const folder of ["CoForge", FOLDER])
          if (!this.plugin.app.vault.getAbstractFileByPath(folder))
            await this.plugin.app.vault.createFolder(folder);
        written = `---\n${stringifyYaml({ type: "coforge-scheduled-stream", version: 1, plan: stored })}---\n${scheduleBody(plan)}`;
        this.files.set(
          plan.id,
          await this.plugin.app.vault.create(
            `${FOLDER}/${plan.id}.md`,
            written,
          ),
        );
      }
      return this.parse(written);
    } catch {
      throw new Error(
        "This stream plan could not be saved. Refresh and review external edits; your draft is still available.",
      );
    }
  }
  async open(id: string): Promise<void> {
    await this.list();
    const file = this.files.get(id);
    if (!file) throw new Error("Stream plan not found. Refresh the schedule.");
    await this.plugin.app.workspace.getLeaf("tab").openFile(file);
  }
}
