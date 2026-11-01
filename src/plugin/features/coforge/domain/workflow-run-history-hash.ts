import { contextEventId } from './integrity';
import type { WorkflowRun } from './configured-workflow-run';
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
  return value;
}
export const workflowRunHistoryHash = (run: WorkflowRun): string => contextEventId(JSON.stringify(ordered(run)));
