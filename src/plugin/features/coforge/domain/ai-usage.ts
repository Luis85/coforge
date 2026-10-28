import { number, optional, shape } from "./check";

/** Raw provider counters: inputTokens is the uncached remainder; cache read/write are separate. */
export interface StageUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}
const counter = number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER });
export const stageUsageCheck = shape(
  {
    inputTokens: optional(counter),
    outputTokens: optional(counter),
    cacheReadInputTokens: optional(counter),
    cacheCreationInputTokens: optional(counter),
  },
  { strict: true },
);
export const USAGE_COUNTERS = [
  "inputTokens",
  "outputTokens",
  "cacheReadInputTokens",
  "cacheCreationInputTokens",
] as const;
export function hasTokenUsage(usage: StageUsage | undefined): boolean {
  return Boolean(
    usage && USAGE_COUNTERS.some((key) => usage[key] !== undefined),
  );
}
export interface UsageTask {
  provider: string;
  usage?: StageUsage;
  usageSource?: "provider";
}
export function tokenSummary(tasks: readonly UsageTask[]) {
  let input = 0n;
  let output = 0n;
  let read = 0n;
  let created = 0n;
  let inclusive = 0n;
  let inputTasks = 0;
  let outputTasks = 0;
  let cacheReadTasks = 0;
  let cacheCreationTasks = 0;
  let completeInputTasks = 0;
  let realTasks = 0;
  for (const task of tasks) {
    if (task.provider === "demo") continue;
    realTasks++;
    if (task.usageSource !== "provider" || !task.usage) continue;
    const usage = task.usage;
    if (usage.inputTokens !== undefined) {
      input += BigInt(usage.inputTokens);
      inputTasks++;
    }
    if (usage.outputTokens !== undefined) {
      output += BigInt(usage.outputTokens);
      outputTasks++;
    }
    if (usage.cacheReadInputTokens !== undefined) {
      read += BigInt(usage.cacheReadInputTokens);
      cacheReadTasks++;
    }
    if (usage.cacheCreationInputTokens !== undefined) {
      created += BigInt(usage.cacheCreationInputTokens);
      cacheCreationTasks++;
    }
    if (
      usage.inputTokens !== undefined &&
      usage.cacheReadInputTokens !== undefined &&
      usage.cacheCreationInputTokens !== undefined
    ) {
      inclusive +=
        BigInt(usage.inputTokens) +
        BigInt(usage.cacheReadInputTokens) +
        BigInt(usage.cacheCreationInputTokens);
      completeInputTasks++;
    }
  }
  return {
    inputTokens: inputTasks ? input : undefined,
    outputTokens: outputTasks ? output : undefined,
    cacheReadInputTokens: cacheReadTasks ? read : undefined,
    cacheCreationInputTokens: cacheCreationTasks ? created : undefined,
    totalInputTokens: completeInputTasks ? inclusive : undefined,
    inputTasks,
    outputTasks,
    cacheReadTasks,
    cacheCreationTasks,
    completeInputTasks,
    realTasks,
  };
}
export const formatTokens = (value?: bigint | number): string =>
  value === undefined ? "Unavailable" : value.toLocaleString();
