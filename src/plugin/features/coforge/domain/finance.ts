import { boolean, list, number, oneOf, shape, text } from "./check";
export interface FinanceEntry {
  id: string;
  kind: "income" | "expense" | "recurring";
  name: string;
  amountCents: number;
  date: string;
  category: string;
  streamId: string;
  cadence: "weekly" | "monthly" | "yearly";
  active: boolean;
}
export interface FinanceLedger {
  currency: "EUR";
  revision: string;
  entries: FinanceEntry[];
}
const entryCheck = shape(
  {
    id: text({ min: 1, max: 100 }),
    kind: oneOf(["income", "expense", "recurring"] as const),
    name: text({ trim: true, min: 1, max: 200 }),
    amountCents: number({ integer: true, min: 1, max: 999999999 }),
    date: text({ min: 10, max: 10 }),
    category: text({ trim: true, max: 100 }),
    streamId: text({ max: 320 }),
    cadence: oneOf(["weekly", "monthly", "yearly"] as const),
    active: boolean,
  },
  { strict: true },
);
export function checkFinanceEntry(input: unknown): FinanceEntry {
  const entry = entryCheck(input);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
    !Number.isFinite(Date.parse(entry.date)) ||
    new Date(entry.date).toISOString().slice(0, 10) !== entry.date
  )
    throw new Error("Choose a valid calendar date.");
  if (entry.kind === "recurring" && entry.streamId)
    throw new Error(
      "Recurring plans are channel commitments; link actual payments to streams.",
    );
  return entry;
}
export const financeEntries = (input: unknown) =>
  list(checkFinanceEntry, { max: 10000 })(input);
export function financeAmount(input: string): number {
  const value = input.trim().replace(",", ".");
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))
    throw new Error(
      "Enter a positive EUR amount with at most two decimal places, without grouping separators.",
    );
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents < 1 || cents > 999999999)
    throw new Error("Enter an amount from €0.01 to €9,999,999.99.");
  return cents;
}
export function financeTotals(
  entries: FinanceEntry[],
  month: string,
  streamId: string,
) {
  const actual = entries.filter(
    (entry) =>
      entry.kind !== "recurring" &&
      entry.date.startsWith(month + "-") &&
      (!streamId || entry.streamId === streamId),
  );
  const income = actual
    .filter((entry) => entry.kind === "income")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const expenses = actual
    .filter((entry) => entry.kind === "expense")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const plannedMonthly = Math.round(
    entries
      .filter(
        (entry) =>
          entry.kind === "recurring" &&
          entry.active &&
          entry.date <= month + "-31",
      )
      .reduce(
        (sum, entry) =>
          sum +
          entry.amountCents *
            (entry.cadence === "weekly"
              ? 52 / 12
              : entry.cadence === "yearly"
                ? 1 / 12
                : 1),
        0,
      ),
  );
  return { income, expenses, balance: income - expenses, plannedMonthly };
}
