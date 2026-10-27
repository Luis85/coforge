import type { FinanceEntry, FinanceLedger } from "../domain/finance";
export interface FinanceStorage {
  load(): Promise<FinanceLedger>;
  save(entries: FinanceEntry[], revision: string): Promise<FinanceLedger>;
}
export interface FinanceActions {
  load(): Promise<FinanceLedger>;
  save(entry: FinanceEntry, revision: string): Promise<FinanceLedger>;
  remove(
    id: string,
    confirmedName: string,
    revision: string,
  ): Promise<FinanceLedger>;
}
