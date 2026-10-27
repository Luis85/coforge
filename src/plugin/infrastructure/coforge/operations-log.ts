import { defineLogCatalog } from "../../features/api";
import type { StructuredLogger } from "../../application/logging";
import { OPERATION_CODES, type OperationRecord } from "../../features/coforge/domain/population";

const catalog = defineLogCatalog("coforge", {
  codes: OPERATION_CODES,
  operations: ["population", "economy", "twitch", "moderation", "chat", "broadcast", "workflow"],
});
/** Diagnostic records contain only declared codes and aggregate metadata, never player IDs or message text. */
export function operationsLog(logger?: Pick<StructuredLogger, "registerCatalog" | "current" | "correlation">) {
  const log = logger?.registerCatalog(catalog);
  return {
    record(record: OperationRecord): void {
      const correlation = logger?.correlation();
      const metadata = { count: record.count, effect: record.effect, ...(correlation ? { correlation } : {}) };
      const operation = record.code.startsWith('obs-') || record.code.startsWith('stream-') || record.code.startsWith('twitch-channel-') ? 'broadcast' : record.code.startsWith('project-') ? 'workflow' : record.code.startsWith("job-")
        ? "workflow"
        : record.code.startsWith("moderation")
          ? "moderation"
          : record.code.startsWith("presence") || record.code === "reward-granted"
            ? "economy"
            : record.code.startsWith("reply") || ["connected", "disconnected"].includes(record.code)
              ? "twitch"
              : record.code === "broadcast-queued"
                ? "broadcast"
                : ["registered", "blocked", "unblocked"].includes(record.code)
                  ? "population"
                  : "chat";
      if (record.code.endsWith("failed") || record.code.endsWith("uncertain"))
        log?.warn(record.code, operation, metadata);
      else if (record.code === "message-observed") log?.debug(record.code, operation, metadata);
      else log?.info(record.code, operation, metadata);
    },
    snapshot: () => logger?.current.filter((record) => record.code.startsWith("coforge.")) ?? [],
  };
}
