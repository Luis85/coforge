import { defineLogCatalog } from "../../features/api";
import type { StructuredLogger } from "../../application/logging";
import { OPERATION_CODES, type OperationRecord } from "../../features/coforge/domain/population";
import { OBS_SCENE_KINDS } from '../../features/coforge/domain/obs-scenes';
import { OBS_SHOW_OPERATION_CODES } from '../../features/coforge/domain/obs-show';
import { OBS_OVERLAY_OPERATION_CODES } from '../../features/coforge/domain/obs-overlay';

const toolCodes = new Set(OPERATION_CODES.filter(code => /^(music|herdr|finance|stream-view|ai-cost|schedule|viewer-note|workflow-nudge|workflow-output-template|workflow-admission)-/.test(code)));
const productionCodes = new Set<string>([...OBS_SHOW_OPERATION_CODES, ...OBS_OVERLAY_OPERATION_CODES]);
const twitchCodes = new Set(OPERATION_CODES.filter(code => /^twitch-(operation|activity|template|retention)-/.test(code)));
const operations = ["population", "economy", "twitch", "moderation", "chat", "broadcast", "workflow", ...OBS_SCENE_KINDS.map(kind => `scene.${kind}` as const)] as const;

const catalog = defineLogCatalog("coforge", {
  codes: OPERATION_CODES.filter(code => !toolCodes.has(code) && !productionCodes.has(code) && !twitchCodes.has(code)),
  operations,
});
const toolsCatalog = defineLogCatalog('coforge.tools', { codes: OPERATION_CODES.filter(code => toolCodes.has(code)), operations });
const productionCatalog = defineLogCatalog('coforge.production', { codes: OPERATION_CODES.filter(code => productionCodes.has(code)), operations });
const twitchCatalog = defineLogCatalog('coforge.twitch', { codes: OPERATION_CODES.filter(code => twitchCodes.has(code)), operations });
/** Diagnostic records contain only declared codes and aggregate metadata, never player IDs or message text. */
export function operationsLog(logger?: Pick<StructuredLogger, "registerCatalog" | "current" | "correlation">) {
  const core = logger?.registerCatalog(catalog);
  const tools = logger?.registerCatalog(toolsCatalog);
  const production = logger?.registerCatalog(productionCatalog);
  const twitch = logger?.registerCatalog(twitchCatalog);
  return {
    record(record: OperationRecord): void {
      const log = productionCodes.has(record.code) ? production : twitchCodes.has(record.code) ? twitch : toolCodes.has(record.code) ? tools : core;
      const correlation = logger?.correlation();
      const metadata = { count: record.count, effect: record.effect, ...(correlation ? { correlation } : {}) };
      const operation = twitchCodes.has(record.code) ? 'twitch' : record.action ? `scene.${record.action}` as const : record.code.startsWith('obs-') || record.code.startsWith('stream-') || record.code.startsWith('twitch-channel-') || record.code.startsWith('music-') || record.code.startsWith('schedule-') ? 'broadcast' : record.code.startsWith('finance-') ? 'economy' : record.code.startsWith('herdr-') || record.code.startsWith('project-') || record.code.startsWith('ai-cost-') ? 'workflow' : (record.code.startsWith("job-") || record.code.startsWith("workflow-"))
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
