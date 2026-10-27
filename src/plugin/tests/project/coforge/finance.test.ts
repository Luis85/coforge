import { describe, expect, it } from "vitest";
import {
  financeAmount,
  financeTotals,
  checkFinanceEntry,
} from "../../../features/coforge/domain/finance";
describe("manual stream finances", () => {
  it("sums recurring estimates as integer twelfths before rounding to cents", () => {
    const entries = Array.from({ length: 6 }, (_, index) =>
      checkFinanceEntry({
        id: String(index),
        kind: "recurring",
        name: "Small annual fee",
        amountCents: 1,
        date: "2026-10-01",
        category: "",
        streamId: "",
        cadence: "yearly",
        active: true,
      }),
    );
    expect(financeTotals(entries, "2026-10", "").plannedMonthly).toBe(1);
  });
  it("uses exact cents, filters actual payments by stream and keeps plans separate", () => {
    expect(financeAmount("10,05")).toBe(1005);
    expect(() => financeAmount("1.005")).toThrow();
    expect(() => financeAmount("-1")).toThrow();
    const base = {
      id: "one",
      kind: "income",
      name: "Stream income",
      amountCents: 1005,
      date: "2026-10-27",
      category: "Tips",
      streamId: "stream1",
      cadence: "monthly",
      active: true,
    };
    const entries = [
      checkFinanceEntry(base),
      checkFinanceEntry({
        ...base,
        id: "two",
        kind: "expense",
        amountCents: 500,
      }),
      checkFinanceEntry({
        ...base,
        id: "plan",
        kind: "recurring",
        amountCents: 12000,
        cadence: "yearly",
        streamId: "",
      }),
    ];
    expect(financeTotals(entries, "2026-10", "stream1")).toEqual({
      income: 1005,
      expenses: 500,
      balance: 505,
      plannedMonthly: 1000,
    });
    expect(financeTotals(entries, "2026-09", "")).toMatchObject({
      income: 0,
      expenses: 0,
      plannedMonthly: 0,
    });
    expect(() => checkFinanceEntry({ ...base, date: "2026-02-30" })).toThrow();
    expect(
      financeTotals(
        [
          ...entries,
          checkFinanceEntry({
            ...base,
            id: "paused",
            kind: "recurring",
            active: false,
            streamId: "",
          }),
        ],
        "2026-10",
        "",
      ),
    ).toMatchObject({ plannedMonthly: 1000 });
  });
});
