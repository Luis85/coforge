import { list, number, oneOf, optional, shape, text, timestamp } from "./check";
export interface AICostTask {
  id: string;
  featureId: string;
  featureTitle: string;
  projectId: string;
  projectName: string;
  provider: "claude" | "herdr" | "demo";
  stage: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  model?: string;
  reportedUsd?: number;
  manualUsd?: string;
  manualNote?: string;
  manualAt?: string;
}
export const aiCostTaskCheck = shape(
  {
    id: text({ min: 1, max: 240 }),
    featureId: text({ min: 1, max: 80 }),
    featureTitle: text({ max: 200 }),
    projectId: text({ max: 80 }),
    projectName: text({ max: 100 }),
    provider: oneOf(["claude", "herdr", "demo"] as const),
    stage: text({ max: 40 }),
    status: text({ max: 40 }),
    startedAt: timestamp,
    finishedAt: optional(timestamp),
    model: optional(text({ max: 100 })),
    reportedUsd: optional(number({ min: 0, max: 1000000000 })),
    manualUsd: optional(text({ max: 40 })),
    manualNote: optional(text({ max: 2000 })),
    manualAt: optional(timestamp),
  },
  { strict: true },
);
export const aiCostTasksCheck = list(aiCostTaskCheck, { max: 100000 });
const SCALE = 1000000000n;
export function usdNanos(input: string): bigint {
  const value = input.trim().replace(",", ".");
  if (!/^\d{1,12}(?:\.\d{1,9})?$/.test(value))
    throw new Error(
      "Enter a non-negative USD amount with up to nine decimal places and no grouping separators.",
    );
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(9, "0"));
}
export function normalizedUsd(input: string): string {
  const nanos = usdNanos(input);
  const fraction = (nanos % SCALE)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return `${nanos / SCALE}${fraction ? "." + fraction : ""}`;
}
export function taskCost(task: AICostTask): {
  nanos?: bigint;
  source: "reported" | "manual" | "unavailable" | "simulation";
} {
  if (task.provider === "demo") return { source: "simulation" };
  if (task.reportedUsd !== undefined)
    return { source: "reported", nanos: usdNanos(task.reportedUsd.toFixed(9)) };
  if (task.manualUsd !== undefined)
    return { source: "manual", nanos: usdNanos(task.manualUsd) };
  return { source: "unavailable" };
}
export function formatUsd(nanos?: bigint): string {
  if (nanos === undefined) return "Unavailable";
  const fraction = (nanos % SCALE)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(nanos / SCALE)
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}
export function costSummary(tasks: readonly AICostTask[]) {
  let nanos = 0n;
  let reported = 0;
  let manual = 0;
  let missing = 0;
  let pending = 0;
  let simulations = 0;
  for (const task of tasks) {
    const cost = taskCost(task);
    if (cost.nanos !== undefined) nanos += cost.nanos;
    if (cost.source === "reported") reported++;
    else if (cost.source === "manual") manual++;
    else if (cost.source === "simulation") simulations++;
    else if (["queued", "running", "pending"].includes(task.status)) pending++;
    else missing++;
  }
  return { nanos, reported, manual, missing, pending, simulations };
}
