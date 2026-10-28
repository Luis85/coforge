import { computed } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { expect, it, vi } from "vitest";
import { useCouncilStore } from "../../../presentation/stores/coforge-council";
import { councilHistoryActions } from "../../../presentation/composables/coforge/council-history-actions";

it("never treats a late export for a different run as the current run retention evidence", async () => {
  setActivePinia(createPinia());
  const store = useCouncilStore();
  let resolveExport: (json: string) => void = () => {};
  const deferred = new Promise<string>((resolve) => {
    resolveExport = resolve;
  });
  const pruneRun = vi.fn(async () => undefined);
  const actions = councilHistoryActions({
    store,
    service: () => ({
      exportRun: async () => deferred,
      pruneRun,
      reassignProjection: async () => undefined,
      handoffPlan: async () => undefined,
      extendAllowance: async () => undefined,
    }),
    run: (work) => work(),
    ideas: computed(() => []),
  });
  store.inspectedRun = "run-a";
  const exporting = actions.exportRun("run-a");
  store.inspectedRun = "run-b";
  store.exportedRun = "";
  store.pruneConsent = true;
  resolveExport('{"run":"run-a"}');
  await exporting;
  expect(store.exportedRun).toBe("");
  await expect(actions.pruneRun("run-b")).rejects.toThrow("Export the run");
  expect(pruneRun).not.toHaveBeenCalled();
});
