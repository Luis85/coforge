import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  FinanceEntry,
  FinanceLedger,
} from "../../features/coforge/domain/finance";
export const financeDraft = (): FinanceEntry => ({
  id: crypto.randomUUID(),
  kind: "expense",
  name: "",
  amountCents: 1,
  date: new Date().toLocaleDateString("en-CA"),
  category: "",
  streamId: "",
  cadence: "monthly",
  active: true,
});
export const useFinanceStore = defineStore("coforge-finance", () => {
  const ledger = ref<FinanceLedger>({
    currency: "EUR",
    revision: "",
    entries: [],
  });
  const draft = ref(financeDraft());
  const amount = ref("");
  const draftRevision = ref("");
  const month = ref(new Date().toLocaleDateString("en-CA").slice(0, 7));
  const stream = ref("");
  const ready = ref(false);
  const busy = ref(false);
  const error = ref("");
  const notice = ref("");
  const example = ref(false);
  const removal = ref<{ entry: FinanceEntry; revision: string } | null>(null);
  return {
    ledger,
    draft,
    amount,
    draftRevision,
    month,
    stream,
    ready,
    busy,
    error,
    notice,
    example,
    removal,
  };
});
