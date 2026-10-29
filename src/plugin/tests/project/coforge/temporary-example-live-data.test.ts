// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import FinanceView from "../../../presentation/components/coforge/FinanceView.vue";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import type { FinanceLedger } from "../../../features/coforge/domain/finance";
import { workflowUiFixture } from "./workflow-ui-fixture";

it("closing temporary examples preserves a real finance ledger and its unsaved manual draft", async () => {
  const fixture = await workflowUiFixture();
  const ledger: FinanceLedger = {
    currency: "EUR",
    revision: "actual-ledger",
    entries: [
      {
        id: "manual",
        name: "Actual subscription",
        kind: "recurring",
        amountCents: 1200,
        date: "2026-01-01",
        category: "Software",
        streamId: "",
        cadence: "monthly",
        active: true,
      },
    ],
  };
  const load = vi.fn(async () => structuredClone(ledger));
  const save = vi.fn(async () => structuredClone(ledger));
  const remove = vi.fn(async () => structuredClone(ledger));
  const finance = { load, save, remove };
  const previewFinance = vi.fn(() => finance);
  const discardPreview = vi.fn();
  const context: CoforgeContext = {
    studio: fixture.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      finance,
      previewFinance,
      discardPreview,
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => false,
      saveExport: async () => "",
      publishBoard: async () => ({ folder: "", changed: false }),
      installPagesWorkflow: async () => ({
        folder: "",
        workflow: "",
        created: false,
      }),
    },
  };
  const wrapper = mount(FinanceView, {
    global: {
      plugins: [fixture.pinia],
      provide: { [coforgeKey as symbol]: context },
    },
  });
  try {
    await flushPromises();
    await wrapper.get('[maxlength="200"]').setValue("Unsaved manual expense");
    fixture.store.closeTemporaryExamples();
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('[maxlength="200"]').element.value,
    ).toBe("Unsaved manual expense");
    expect(wrapper.text()).toContain("Actual subscription");
    expect(wrapper.text()).not.toContain("Exit example");
    expect(previewFinance).not.toHaveBeenCalled();
    expect(discardPreview).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
