import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  type ComponentPublicInstance,
} from "vue";
import { useCoforge } from "../../context/coforge-context";
import { financeDraft, useFinanceStore } from "../../stores/coforge-finance";
import {
  financeAmount,
  financeTotals,
  type FinanceEntry,
} from "../../../features/coforge/domain/finance";
import type { StreamSummary } from "../../../features/coforge/domain/stream-metrics";
import { useTemporaryExample } from "./use-temporary-example";
export function useFinance() {
  const { host } = useCoforge();
  const store = useFinanceStore();
  const streams = ref<StreamSummary[]>([]);
  const confirmation = ref<HTMLElement | null>(null);
  let closed = false;
  let focus: HTMLElement | null = null;
  const actions = () =>
    store.example ? host.previewFinance?.() : host.finance;
  const money = (cents: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  const streamName = (id: string) => {
    const stream = streams.value.find((stream) => stream.id === id);
    return stream
      ? new Date(stream.startedAt).toLocaleString()
      : id || "Unassigned";
  };
  async function run(work: () => Promise<void>) {
    if (store.busy || closed) return;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
    } catch (error) {
      if (!closed)
        store.error =
          error instanceof Error
            ? error.message
            : "Finances could not be updated.";
    } finally {
      store.busy = false;
    }
  }
  async function load() {
    const service = actions();
    if (!service) return;
    const ledger = await service.load();
    if (closed) return;
    store.ledger = ledger;
    store.ready = true;
    store.removal = null;
    if (!store.draft.name && !store.amount)
      store.draftRevision = ledger.revision;
    try {
      streams.value = (await host.streamHistory?.list()) ?? [];
    } catch {
      streams.value = [];
    }
  }
  onMounted(() => {
    void run(load);
  });
  onBeforeUnmount(() => {
    closed = true;
  });
  const reset = () => {
    store.draft = financeDraft();
    store.amount = "";
    store.draftRevision = store.ledger.revision;
  };
  const cancelRemoval = () => {
    store.removal = null;
    if (focus?.isConnected) focus.focus();
  };
  const exitExample = () => {
    if (!store.example) return;
    store.example = false;
    store.ledger = { currency: "EUR", revision: "", entries: [] };
    store.ready = false;
    store.removal = null;
    store.stream = "";
    store.error = "";
    store.notice = "";
    reset();
    host.discardPreview?.("finance");
  };
  const beginExample = useTemporaryExample("finance", exitExample);
  return reactive({
    store,
    streams,
    money,
    streamName,
    reset,
    cancelRemoval,
    available: computed(() => Boolean(actions())),
    canPreview: Boolean(host.previewFinance),
    totals: computed(() =>
      financeTotals(store.ledger.entries, store.month, store.stream),
    ),
    entries: computed(() =>
      store.ledger.entries
        .filter(
          (entry) =>
            entry.kind === "recurring" ||
            (entry.date.startsWith(store.month + "-") &&
              (!store.stream || entry.streamId === store.stream)),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    ),
    editing: computed(() =>
      store.ledger.entries.some((entry) => entry.id === store.draft.id),
    ),
    preview: () => {
      if (host.finance || store.busy) return;
      beginExample();
      store.example = true;
      void run(load);
    },
    exitExample,
    refresh: () => {
      void run(load);
    },
    edit: (entry: FinanceEntry) => {
      store.draft = { ...entry };
      store.amount = (entry.amountCents / 100).toFixed(2);
      store.draftRevision = store.ledger.revision;
    },
    save: (event: Event) => {
      event.preventDefault();
      void run(async () => {
        const service = actions();
        if (!service) return;
        const entry = {
          ...store.draft,
          amountCents: financeAmount(store.amount),
          streamId:
            store.draft.kind === "recurring" ? "" : store.draft.streamId,
        };
        store.ledger = await service.save(entry, store.draftRevision);
        reset();
        store.notice = "Finance entry saved.";
      });
    },
    toggle: (entry: FinanceEntry) => {
      void run(async () => {
        const service = actions();
        if (service)
          store.ledger = await service.save(
            { ...entry, active: !entry.active },
            store.ledger.revision,
          );
      });
    },
    remove: async (entry: FinanceEntry) => {
      store.removal = { entry: { ...entry }, revision: store.ledger.revision };
      focus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      await nextTick();
      confirmation.value?.focus();
    },
    bindConfirmation: (value: Element | ComponentPublicInstance | null) => {
      confirmation.value = value instanceof HTMLElement ? value : null;
    },
    confirmRemoval: () => {
      const target = store.removal;
      if (target)
        void run(async () => {
          const service = actions();
          if (!service) return;
          store.ledger = await service.remove(
            target.entry.id,
            target.entry.name,
            target.revision,
          );
          store.removal = null;
          if (store.draft.id === target.entry.id) reset();
          store.notice = "Finance entry deleted.";
        });
    },
  });
}
export type FinanceModel = ReturnType<typeof useFinance>;
export function useFinanceDraft() {
  return useFinanceStore();
}
