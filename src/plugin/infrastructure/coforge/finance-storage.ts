import { parseYaml, stringifyYaml, type Plugin } from "obsidian";
import type { FinanceStorage } from "../../features/coforge/application/finance-ports";
import {
  financeEntries,
  type FinanceEntry,
  type FinanceLedger,
} from "../../features/coforge/domain/finance";
import { splitNote } from "./markdown";
import { record } from "../../features/coforge/domain/check";
const PATH = "CoForge/Finance/Ledger.md";
/** Private canonical ledger; vault.process protects external edits and preserves unknown properties/body bytes. */
export class VaultFinance implements FinanceStorage {
  private observed = "";
  private revision = "";
  constructor(private readonly plugin: Plugin) {}
  async load(): Promise<FinanceLedger> {
    try {
      const file = this.plugin.app.vault.getFileByPath(PATH);
      if (!file) {
        this.observed = "";
        this.revision = "";
        return { currency: "EUR", revision: "", entries: [] };
      }
      if (file.stat.size > 4 * 1024 * 1024) throw new Error("Oversized ledger");
      const content = await this.plugin.app.vault.read(file);
      const { yaml } = splitNote(content);
      const properties = record(parseYaml(yaml ?? ""));
      if (
        properties.type !== "coforge-finance" ||
        properties.currency !== "EUR" ||
        properties.version !== 1
      )
        throw new Error("Invalid ledger");
      const entries = financeEntries(properties.entries);
      if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
        throw new Error("Duplicate IDs");
      if (content !== this.observed) this.revision = crypto.randomUUID();
      this.observed = content;
      return { currency: "EUR", revision: this.revision, entries };
    } catch {
      throw new Error(
        "The finance ledger could not be read. Check CoForge/Finance/Ledger.md; its contents were preserved.",
      );
    }
  }
  async save(input: FinanceEntry[], revision: string): Promise<FinanceLedger> {
    const entries = financeEntries(input);
    if (revision !== this.revision)
      throw new Error("The ledger changed. Refresh before saving.");
    try {
      const { vault } = this.plugin.app;
      const file = vault.getFileByPath(PATH);
      const properties = {
        type: "coforge-finance",
        version: 1,
        currency: "EUR",
        entries,
      };
      if (file)
        await vault.process(file, (current) => {
          if (current !== this.observed || !revision)
            throw new Error("External change");
          const { yaml, body } = splitNote(current);
          return `---\n${stringifyYaml({ ...record(parseYaml(yaml ?? "")), ...properties })}---\n${body}`;
        });
      else {
        if (revision || this.observed) throw new Error("Deleted externally");
        for (const folder of ["CoForge", "CoForge/Finance"])
          if (!vault.getAbstractFileByPath(folder))
            await vault.createFolder(folder);
        await vault.create(
          PATH,
          `---\n${stringifyYaml(properties)}---\n\n# Stream finance ledger\n\nActual transactions and recurring plans are separate. Amounts are integer EUR cents.\n`,
        );
      }
      return await this.load();
    } catch {
      throw new Error(
        "The finance ledger could not be saved. Refresh and review external edits or vault access; your draft is retained.",
      );
    }
  }
}
