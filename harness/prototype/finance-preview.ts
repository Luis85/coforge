import { FinanceService } from "../../src/plugin/features/coforge/application/finance-service";
import type { FinanceLedger } from "../../src/plugin/features/coforge/domain/finance";
import type { StudioStore } from "../../src/plugin/features/coforge/application/studio-store";
export function createFinancePreview(store: StudioStore) {
  let ledger: FinanceLedger = { currency: "EUR", revision: "", entries: [] };
  return new FinanceService(
    {
      load: async () => structuredClone(ledger),
      save: async (entries, revision) => {
        if (revision !== ledger.revision)
          throw new Error("The example ledger changed. Refresh first.");
        ledger = {
          currency: "EUR",
          revision: crypto.randomUUID(),
          entries: structuredClone(entries),
        };
        return structuredClone(ledger);
      },
    },
    store,
  );
}
