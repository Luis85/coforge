import {
  checkFinanceEntry,
  type FinanceEntry,
  type FinanceLedger,
} from "../domain/finance";
import type { FinanceActions, FinanceStorage } from "./finance-ports";
import type { StudioStore } from "./studio-store";
import { recordOperation } from "./population";
export class FinanceService implements FinanceActions {
  private busy = false;
  constructor(
    private readonly storage: FinanceStorage,
    private readonly store: StudioStore,
  ) {}
  private async command<T>(work: () => Promise<T>): Promise<T> {
    if (this.busy)
      throw new Error("A finance interaction is already in progress.");
    this.busy = true;
    try {
      return await work();
    } finally {
      this.busy = false;
    }
  }
  load(): Promise<FinanceLedger> {
    return this.command(async () => {
      const ledger = await this.storage.load();
      await this.store.transaction((state) =>
        recordOperation(state, "finance-refreshed"),
      );
      return ledger;
    });
  }
  save(input: FinanceEntry, revision: string): Promise<FinanceLedger> {
    return this.command(async () => {
      const entry = checkFinanceEntry(input);
      const ledger = await this.storage.load();
      if (ledger.revision !== revision)
        throw new Error(
          "The finance ledger changed. Refresh and review your draft before saving.",
        );
      const entries = [
        ...ledger.entries.filter((item) => item.id !== entry.id),
        entry,
      ];
      const saved = await this.storage.save(entries, revision);
      await this.store.transaction((state) =>
        recordOperation(state, "finance-entry-saved"),
      );
      return saved;
    });
  }
  remove(
    id: string,
    confirmedName: string,
    revision: string,
  ): Promise<FinanceLedger> {
    return this.command(async () => {
      const ledger = await this.storage.load();
      const entry = ledger.entries.find((entry) => entry.id === id);
      if (
        ledger.revision !== revision ||
        !entry ||
        entry.name !== confirmedName
      )
        throw new Error(
          "The finance entry changed. Refresh and confirm the exact entry again.",
        );
      const saved = await this.storage.save(
        ledger.entries.filter((entry) => entry.id !== id),
        revision,
      );
      await this.store.transaction((state) =>
        recordOperation(state, "finance-entry-deleted"),
      );
      return saved;
    });
  }
}
