import { boolean, list, number, oneOf, optional, record, shape, text } from './check';
import { contextEventId } from './integrity';
import { agentModelCheck, stageAgent } from './stage-agents';
import { resolvedStagePrompts } from './stage-prompts';
import { STAGES, STAGE_LABELS, type Provider, type Settings } from './types';

export const WORKFLOW_OUTPUTS = ['markdown', 'screening', 'rice', 'plan', 'codechange'] as const;
export const WORKFLOW_ACCESS = ['none', 'readproject', 'editworktree'] as const;
export type WorkflowOutput = typeof WORKFLOW_OUTPUTS[number];
export type WorkflowAccess = typeof WORKFLOW_ACCESS[number];
interface StepBase { id: string; name: string; instructions: string }
export interface AiWorkflowStep extends StepBase {
  kind: 'ai'; output: WorkflowOutput; access: WorkflowAccess; provider: Provider; model: string;
  herdrAgent?: 'claude'; automatic: boolean; minVotes?: number; inputs?: WorkflowOutput[];
}
export interface ApprovalWorkflowStep extends StepBase { kind: 'approval' }
export interface ChecklistWorkflowStep extends StepBase { kind: 'checklist'; items: Array<{ id: string; label: string; required: boolean }> }
export interface NudgeWorkflowStep extends StepBase { kind: 'nudge'; teamId: string; agentId: string; inputs?: WorkflowOutput[]; automatic?: boolean }
export type WorkflowStep = AiWorkflowStep | ApprovalWorkflowStep | ChecklistWorkflowStep | NudgeWorkflowStep;
export interface WorkflowDefinition {
  format: 'coforge-workflow/v1'; revision: string; name: string;
  limits: { timeoutSeconds: number; maxTurns: number; maxBudgetUsd: number; intervalSeconds: number };
  steps: WorkflowStep[];
}
export const workflowIdCheck = text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u });
const base = { id: workflowIdCheck, name: text({ trim: true, min: 1, max: 100 }), instructions: text({ max: 8000 }) };
const ai = shape({ ...base, kind: oneOf(['ai'] as const), output: oneOf(WORKFLOW_OUTPUTS), access: oneOf(WORKFLOW_ACCESS),
  provider: oneOf(['demo', 'claude', 'herdr'] as const), model: agentModelCheck, herdrAgent: optional(oneOf(['claude'] as const)),
  automatic: boolean, minVotes: optional(number({ integer: true, min: 0, max: 10000 })), inputs: optional(list(oneOf(WORKFLOW_OUTPUTS), { max: 5 })),
}, { strict: true });
const approval = shape({ ...base, kind: oneOf(['approval'] as const) }, { strict: true });
const checklist = shape({ ...base, kind: oneOf(['checklist'] as const), items: list(shape({ id: workflowIdCheck, label: text({ trim: true, min: 1, max: 500 }), required: boolean }, { strict: true }), { min: 1, max: 40 }) }, { strict: true });
const nudge = shape({ ...base, kind: oneOf(['nudge'] as const), teamId: workflowIdCheck, agentId: workflowIdCheck, inputs: optional(list(oneOf(WORKFLOW_OUTPUTS), { max: 5 })), automatic: optional(boolean) }, { strict: true });
export function workflowStepCheck(value: unknown): WorkflowStep {
  const kind = record(value).kind;
  const step = kind === 'ai' ? ai(value) : kind === 'approval' ? approval(value) : kind === 'nudge' ? nudge(value) : checklist(value);
  if (step.kind === 'nudge' && (!step.instructions.trim() || new Set(step.inputs).size !== (step.inputs?.length ?? 0))) throw new Error('A nudge needs a prompt and unique input roles.');
  if (step.kind === 'ai' && ((step.output === 'codechange' && step.access !== 'editworktree') || new Set(step.inputs).size !== (step.inputs?.length ?? 0)))
    throw new Error('A code-change step requires worktree editing and input roles must be unique.');
  if (step.kind === 'checklist' && new Set(step.items.map(item => item.id)).size !== step.items.length) throw new Error('Checklist item IDs must be unique.');
  return step;
}
const definition = shape({ format: oneOf(['coforge-workflow/v1'] as const), revision: workflowIdCheck, name: text({ trim: true, min: 1, max: 100 }),
  limits: shape({ timeoutSeconds: number({ integer: true, min: 15, max: 1800 }), maxTurns: number({ integer: true, min: 1, max: 50 }),
    maxBudgetUsd: number({ min: 0.1, max: 20 }), intervalSeconds: number({ integer: true, min: 2, max: 3600 }) }, { strict: true }),
  steps: list(workflowStepCheck, { min: 1, max: 40 }),
}, { strict: true });
export function workflowDefinitionCheck(value: unknown): WorkflowDefinition {
  const checked = definition(value);
  if (new Set(checked.steps.map(step => step.id)).size !== checked.steps.length) throw new Error('Workflow step IDs must be unique.');
  const available = new Set<WorkflowOutput>();
  for (const step of checked.steps) if (step.kind === 'ai' || step.kind === 'nudge') {
    if (step.inputs?.some(role => !available.has(role))) throw new Error('A required input role has no preceding producer.');
    if (step.kind === 'ai') { available.add(step.output); if (step.access === 'editworktree') available.add('codechange'); }
  }
  return checked;
}
export const validateWorkflowDefinition = workflowDefinitionCheck;
export function parseWorkflowDefinition(json: string): WorkflowDefinition {
  if (json.length > 400000) throw new Error('The workflow import exceeds its size limit.');
  try { return workflowDefinitionCheck(JSON.parse(json)); } catch { throw new Error('The workflow JSON is invalid or uses unsupported steps, permissions or limits.'); }
}
export const serializeWorkflowDefinition = (value: WorkflowDefinition): string => JSON.stringify(workflowDefinitionCheck(value), null, 2);
export function defaultWorkflowDefinition(settings: Settings): WorkflowDefinition {
  const outputs: Record<typeof STAGES[number], WorkflowOutput> = { screen: 'screening', score: 'rice', plan: 'plan', implement: 'codechange' };
  const prompts = resolvedStagePrompts(settings.stagePrompts);
  const steps: WorkflowStep[] = STAGES.map(stage => ({ id: stage, name: STAGE_LABELS[stage], instructions: prompts[stage], kind: 'ai',
    output: outputs[stage], access: stage === 'implement' ? 'editworktree' : stage === 'plan' ? 'readproject' : 'none',
    ...stageAgent(settings, stage), automatic: settings.automation[stage], minVotes: stage === 'plan' ? settings.minVotes : 0 }));
  const value = { format: 'coforge-workflow/v1' as const, name: 'Community development', limits: { timeoutSeconds: settings.timeoutSeconds,
    maxTurns: settings.maxTurns, maxBudgetUsd: settings.maxBudgetUsd, intervalSeconds: settings.intervalSeconds }, steps };
  return workflowDefinitionCheck({ ...value, revision: `legacy-${contextEventId(JSON.stringify(value))}` });
}
export const workflowDefinition = (settings: Settings): WorkflowDefinition => settings.workflow ? workflowDefinitionCheck(settings.workflow) : defaultWorkflowDefinition(settings);
