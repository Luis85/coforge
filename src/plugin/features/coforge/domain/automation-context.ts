import { list, optional, shape, text, timestamp } from './check';
export const AUTOMATION_MAX_DEPTH = 4;
const id = text({ min: 1, max: 100 });
export interface AutomationOrigin { rootEventId: string; bindingIds: string[] }
export const automationOriginCheck = (value: unknown): AutomationOrigin => {
  const checked = shape({ rootEventId: id, bindingIds: list(id, { min: 1, max: AUTOMATION_MAX_DEPTH }) }, { strict: true })(value);
  if (new Set(checked.bindingIds).size !== checked.bindingIds.length) throw new Error('Repeated event bindings are not allowed in an automation chain.');
  return checked;
};
export interface AutomationContext { id: string; type: string; at: string; projectId?: string; ideaId?: string; jobId?: string; runId?: string; origin?: AutomationOrigin }
export const automationContextCheck = shape({ id, type: text({ min: 1, max: 100 }), at: timestamp,
  projectId: optional(text({ pattern: /^CFP-\d+$/u })), ideaId: optional(text({ pattern: /^CF-\d+$/u })),
  jobId: optional(id), runId: optional(id), origin: optional(automationOriginCheck) }, { strict: true });
