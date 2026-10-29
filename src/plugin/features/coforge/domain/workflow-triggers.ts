import { boolean, list, number, oneOf, optional, record, shape, text } from './check';
import { OPERATION_CODES } from './population';
import { AUTOMATION_MAX_DEPTH, automationContextCheck, type AutomationContext } from './automation-context';
export { AUTOMATION_MAX_DEPTH };
export const AUTOMATION_SOURCE_FOLDER = 'CoForge/Automations';
export const workflowTriggerSourcePath = (id: string): string => `${AUTOMATION_SOURCE_FOLDER}/${id}.md`;
export const WORKFLOW_TRIGGER_EVENTS = [...OPERATION_CODES, 'execution-admitted', 'execution-completed', 'execution-attention', 'execution-cancelled'] as const;
export type WorkflowTriggerEvent = typeof WORKFLOW_TRIGGER_EVENTS[number];
export interface WorkflowTriggerDraft {
  name: string; enabled: boolean; event: WorkflowTriggerEvent; scope: 'application' | 'project'; projectId: string;
  workflow: 'v1' | 'v2'; workflowRevision: string; request: 'event' | 'fixed'; ideaId?: string; cooldownSeconds: number;
}
export interface WorkflowTrigger extends WorkflowTriggerDraft { id: string; revision: number; enabledAt: number; lastStartedAt?: number }
export interface WorkflowTriggerOccurrence {
  id: string; bindingId: string; bindingRevision: number; event: AutomationContext; snapshot: WorkflowTriggerDraft;
  status: 'reserved' | 'submitted' | 'skipped' | 'attention'; reason: string; at: number; runId?: string;
  sourcePath?: string; definitionJson?: string; acknowledgedAt?: number;
}
export interface WorkflowTriggerState { format: 'coforge-workflow-triggers/v1'; revision: number; bindings: WorkflowTrigger[]; occurrences: WorkflowTriggerOccurrence[]; seen: string[] }
const id = text({ min: 1, max: 100 }); const integer = number({ integer: true, min: 0 });
const fields = { name: text({ trim: true, min: 1, max: 100 }), enabled: boolean, event: oneOf(WORKFLOW_TRIGGER_EVENTS),
  scope: oneOf(['application', 'project'] as const), projectId: text({ pattern: /^CFP-\d+$/u }), workflow: oneOf(['v1', 'v2'] as const),
  workflowRevision: text({ min: 1, max: 200 }), request: oneOf(['event', 'fixed'] as const), ideaId: optional(text({ pattern: /^CF-\d+$/u })),
  cooldownSeconds: number({ integer: true, min: 1, max: 86400 }) };
export function workflowTriggerDraftCheck(value: unknown): WorkflowTriggerDraft {
  const checked = shape(fields, { strict: true })(value);
  if (checked.request === 'fixed' && !checked.ideaId || checked.request === 'event' && checked.ideaId !== undefined) throw new Error('Select one existing request, or use the request carried by the event.');
  return checked;
}
function binding(value: unknown): WorkflowTrigger {
  const raw = record(value); const metadata = shape({ id, revision: integer, enabledAt: integer, lastStartedAt: optional(integer) })(raw);
  return { ...workflowTriggerDraftCheck(Object.fromEntries(Object.entries(raw).filter(([key]) => !['id', 'revision', 'enabledAt', 'lastStartedAt'].includes(key)))), ...metadata };
}
const occurrence = shape({ id, bindingId: id, bindingRevision: integer, event: automationContextCheck, snapshot: workflowTriggerDraftCheck,
  status: oneOf(['reserved', 'submitted', 'skipped', 'attention'] as const), reason: text({ max: 1000 }), at: integer,
  runId: optional(id), sourcePath: optional(text({ max: 1000 })), definitionJson: optional(text({ max: 1000000 })), acknowledgedAt: optional(integer) }, { strict: true });
export function workflowTriggerStateCheck(value: unknown): WorkflowTriggerState {
  const state = shape({ format: oneOf(['coforge-workflow-triggers/v1'] as const), revision: integer,
    bindings: list(binding, { max: 100 }), occurrences: list(occurrence, { max: 200 }), seen: list(id, { max: 1000 }) }, { strict: true })(value);
  if (new Set(state.bindings.map(item => item.id)).size !== state.bindings.length || new Set(state.occurrences.map(item => item.id)).size !== state.occurrences.length) throw new Error('Duplicate workflow-trigger identities are not allowed.');
  return state;
}
export const emptyWorkflowTriggers = (): WorkflowTriggerState => ({ format: 'coforge-workflow-triggers/v1', revision: 0, bindings: [], occurrences: [], seen: [] });
