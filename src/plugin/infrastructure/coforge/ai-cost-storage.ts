import { parseYaml, stringifyYaml, type Plugin } from "obsidian";
import type { AICostStorage } from "../../features/coforge/application/ai-cost-ports";
import {
  aiCostTasksCheck,
  usdNanos,
  type AICostTask,
} from "../../features/coforge/domain/ai-costs";
import { record } from "../../features/coforge/domain/check";
import {
  cleanText,
  defangProperty,
} from "../../features/coforge/domain/sanitize";
import { splitNote } from "./markdown";
import { mapCostStrings } from './ai-cost-strings';
const PATH = "CoForge/AI-Costs/Ledger.md";
export class VaultAICosts implements AICostStorage {
  private observed: string | null = null;
  constructor(private readonly plugin: Plugin) {}
  async load(): Promise<AICostTask[]> {
    try {
      const file = this.plugin.app.vault.getFileByPath(PATH);
      if (!file) {
        if (this.observed !== null) throw new Error("Ledger removed");
        return [];
      }
      if (file.stat.size > 60 * 1024 * 1024)
        throw new Error("Cost ledger too large");
      const content = await this.plugin.app.vault.read(file);
      const properties = record(parseYaml(splitNote(content).yaml ?? ""));
      if (
        properties.type !== "coforge-ai-costs" ||
        properties.currency !== "USD" ||
        properties.version !== 1
      )
        throw new Error("Invalid cost ledger");
      const rawTasks = properties.tasks;
      const tasks = aiCostTasksCheck(mapCostStrings(rawTasks, value => cleanText(value)));
      if (new Set(tasks.map((task) => task.id)).size !== tasks.length)
        throw new Error("Duplicate cost task");
      for (const task of tasks)
        if (task.manualUsd !== undefined) usdNanos(task.manualUsd);
      this.observed = content;
      return tasks;
    } catch {
      throw new Error(
        "The private AI cost ledger could not be read. Check CoForge/AI-Costs/Ledger.md; its contents were preserved.",
      );
    }
  }
  async save(input: AICostTask[]): Promise<void> {
    const tasks = aiCostTasksCheck(input);
    try {
      const { vault } = this.plugin.app;
      const file = vault.getFileByPath(PATH);
      const properties = {
        type: "coforge-ai-costs",
        version: 1,
        currency: "USD",
        tasks: mapCostStrings(tasks, defangProperty),
      };
      let written = "";
      if (file)
        await vault.process(file, (current) => {
          if (current !== this.observed)
            throw new Error("External cost ledger edit");
          const { yaml, body } = splitNote(current);
          written = `---\n${stringifyYaml({ ...record(parseYaml(yaml ?? "")), ...properties })}---\n${body}`;
          return written;
        });
      else {
        if (this.observed !== null) throw new Error("Ledger removed");
        for (const folder of ["CoForge", "CoForge/AI-Costs"])
          if (!vault.getAbstractFileByPath(folder))
            await vault.createFolder(folder);
        written = `---\n${stringifyYaml(properties)}---\n\n# AI usage cost ledger\n\nProvider-reported and manual task costs in USD. These are separate from cash payments in the finance ledger.\n`;
        await vault.create(PATH, written);
      }
      this.observed = written;
    } catch {
      throw new Error(
        "AI cost history could not be saved. Refresh the cost dashboard and review external edits or vault access. New task data has not been discarded.",
      );
    }
  }
}
