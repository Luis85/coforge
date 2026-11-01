import { CheckError, boolean, list, number, oneOf, optional, record, shape, text } from './check';
import { contextEventId } from './integrity';
import { reasoningEffortCheck, validateModelEffort, type ReasoningEffort } from './provider-models';
import { agentModelCheck, stageAgent } from './stage-agents';
import { durableBuildPolicyCheck, type DurableBuildPolicy } from './durable-build';
import { resolvedStagePrompts } from './stage-prompts';
import { STAGES, STAGE_LABELS, type Provider, type Settings } from './types';
import { validateWorkflowBuckets, workflowBucketCheck, type WorkflowBucket } from './workflow-buckets';
import { improvementPassConfigurationCheck, type ImprovementPassConfiguration } from './polishing-pass-configuration';

export const WORKFLOW_OUTPUTS = ['markdown', 'screening', 'rice', 'plan', 'design', 'codechange'] as const;
export const WORKFLOW_ACCESS = ['none', 'readproject', 'editworktree'] as const;
export type WorkflowOutput = typeof WORKFLOW_OUTPUTS[number];
export type WorkflowAccess = typeof WORKFLOW_ACCESS[number];
interface StepBase { id: string; name: string; instructions: string; bucketId?: string }
export interface AiWorkflowStep extends StepBase {
  execution?: DurableBuildPolicy;
  coworkerId?: string;
  outputTemplateId?: string;
  /** Include other preceding results without requiring optional host captures to exist. */
  includePreviousResults?: boolean;
  kind: 'ai'; output: WorkflowOutput; access: WorkflowAccess; provider: Provider; model: string;
  effort?: ReasoningEffort;
  herdrAgent?: 'claude'; automatic: boolean; minVotes?: number; inputs?: WorkflowOutput[];
}
export interface ApprovalWorkflowStep extends StepBase { kind: 'approval' }
export interface ChecklistWorkflowStep extends StepBase { kind: 'checklist'; items: Array<{ id: string; label: string; required: boolean }> }
export interface NudgeWorkflowStep extends StepBase { kind: 'nudge'; teamId: string; agentId: string; inputs?: WorkflowOutput[]; automatic?: boolean }
export interface CouncilWorkflowStep extends StepBase { kind: 'council'; councilId: string; inputs?: WorkflowOutput[]; contextMode?: 'all' | 'selected' | 'none'; automatic: boolean }
export type WorkflowStep = AiWorkflowStep | ApprovalWorkflowStep | ChecklistWorkflowStep | NudgeWorkflowStep | CouncilWorkflowStep;
export interface WorkflowDefinition {
  improvementPass?: ImprovementPassConfiguration;
  format: 'coforge-workflow/v1'; revision: string; name: string;
  startupMode?: 'paused' | 'play';
  buckets?: WorkflowBucket[];
  limits: { timeoutSeconds: number; maxTurns: number; maxBudgetUsd: number; intervalSeconds: number };
  steps: WorkflowStep[];
}
export const workflowIdCheck = text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u });
const base = { id: workflowIdCheck, name: text({ trim: true, min: 1, max: 100 }), instructions: text({ max: 8000 }), bucketId: optional(workflowIdCheck) };
const ai = shape({ ...base, kind: oneOf(['ai'] as const), output: oneOf(WORKFLOW_OUTPUTS), access: oneOf(WORKFLOW_ACCESS),
  execution: optional(durableBuildPolicyCheck),
  coworkerId: optional(workflowIdCheck),
  outputTemplateId: optional(workflowIdCheck),
  includePreviousResults: optional(boolean),
  provider: oneOf(['demo', 'claude', 'herdr', 'codex'] as const), model: agentModelCheck, herdrAgent: optional(oneOf(['claude'] as const)),
  effort: optional(reasoningEffortCheck),
  automatic: boolean, minVotes: optional(number({ integer: true, min: 0, max: 10000 })), inputs: optional(list(oneOf(WORKFLOW_OUTPUTS), { max: WORKFLOW_OUTPUTS.length })),
}, { strict: true });
const approval = shape({ ...base, kind: oneOf(['approval'] as const) }, { strict: true });
const checklist = shape({ ...base, kind: oneOf(['checklist'] as const), items: list(shape({ id: workflowIdCheck, label: text({ trim: true, min: 1, max: 500 }), required: boolean }, { strict: true }), { min: 1, max: 40 }) }, { strict: true });
const nudge = shape({ ...base, kind: oneOf(['nudge'] as const), teamId: workflowIdCheck, agentId: workflowIdCheck, inputs: optional(list(oneOf(WORKFLOW_OUTPUTS), { max: WORKFLOW_OUTPUTS.length })), automatic: optional(boolean) }, { strict: true });
const council = shape({ ...base, kind: oneOf(['council'] as const), councilId: workflowIdCheck, contextMode: optional(oneOf(['all', 'selected', 'none'] as const)), inputs: optional(list(oneOf(WORKFLOW_OUTPUTS), { max: WORKFLOW_OUTPUTS.length })), automatic: boolean }, { strict: true });
export function workflowStepCheck(value: unknown): WorkflowStep {
  const kind = record(value).kind;
  const step = kind === 'ai' ? ai(value) : kind === 'approval' ? approval(value) : kind === 'nudge' ? nudge(value) : kind === 'council' ? council(value) : checklist(value);
  if (step.kind === 'ai') validateModelEffort(step);
  if (step.kind === 'ai' && step.execution && (step.output !== 'codechange' || step.access !== 'editworktree' || !step.coworkerId && !['claude', 'codex'].includes(step.provider))) throw new Error('Background execution requires a native Claude or Codex Build with isolated worktree editing.');
  if (step.kind === 'council' && (!step.instructions.trim() || new Set(step.inputs).size !== (step.inputs?.length ?? 0))) throw new Error('Ask Council needs a prompt and unique input roles.');
  if (step.kind === 'council' && step.contextMode === 'selected' && !step.inputs?.length) throw new Error('Choose at least one earlier result role, or choose no earlier results.');
  if (step.kind === 'nudge' && (!step.instructions.trim() || new Set(step.inputs).size !== (step.inputs?.length ?? 0))) throw new Error('A nudge needs a prompt and unique input roles.');
  if (step.kind === 'ai' && ((step.output === 'codechange' && step.access !== 'editworktree') || new Set(step.inputs).size !== (step.inputs?.length ?? 0)))
    throw new Error('A code-change step requires worktree editing and input roles must be unique.');
  if (step.kind === 'checklist' && new Set(step.items.map(item => item.id)).size !== step.items.length) throw new Error('Checklist item IDs must be unique.');
  return step;
}
const definition = shape({ format: oneOf(['coforge-workflow/v1'] as const), revision: workflowIdCheck, name: text({ trim: true, min: 1, max: 100 }),
  improvementPass: optional(improvementPassConfigurationCheck),
  startupMode: optional(oneOf(['paused', 'play'] as const)),
  buckets: optional(list(workflowBucketCheck, { min: 2, max: 12 })),
  limits: shape({ timeoutSeconds: number({ integer: true, min: 15, max: 1800 }), maxTurns: number({ integer: true, min: 1, max: 50 }),
    maxBudgetUsd: number({ min: 0.1, max: 20 }), intervalSeconds: number({ integer: true, min: 2, max: 3600 }) }, { strict: true }),
  steps: list(workflowStepCheck, { min: 1, max: 40 }),
}, { strict: true });
export function workflowDefinitionCheck(value: unknown): WorkflowDefinition {
  const checked = definition(value);
  if (new Set(checked.steps.map(step => step.id)).size !== checked.steps.length) throw new Error('Workflow step IDs must be unique.');
  validateWorkflowBuckets(checked);
  if (checked.steps.some(step => step.kind === 'ai' && step.execution?.mode === 'background')) {
    const mixed = checked.steps.findIndex(step => step.kind === 'ai' && step.access === 'editworktree' && step.execution?.mode !== 'background');
    const step = checked.steps[mixed];
    if (step?.kind === 'ai') throw new CheckError(`steps[${mixed}].${step.output === 'codechange' ? 'execution' : 'access'}`, 'All editing steps in a background-workspace workflow must use background execution. Native read-only and no-access follow-ups can remain foreground.');
  }
  const available = new Set<WorkflowOutput>();
  for (const step of checked.steps) if (step.kind === 'ai' || step.kind === 'nudge' || step.kind === 'council') {
    if ((step.kind !== 'council' || !step.contextMode || step.contextMode === 'selected') && step.inputs?.some(role => !available.has(role))) throw new Error('A required input role has no preceding producer.');
    if (step.kind === 'ai') { available.add(step.output); if (step.access === 'editworktree') available.add('codechange'); }
    if (step.kind === 'council') available.add('markdown');
  }
  return checked;
}
export const validateWorkflowDefinition = workflowDefinitionCheck;
export function parseWorkflowDefinition(json: string): WorkflowDefinition {
  if (json.length > 400000) throw new Error('The workflow import exceeds its size limit.');
  try { return workflowDefinitionCheck(JSON.parse(json)); } catch { throw new Error('The workflow JSON is invalid or uses unsupported steps, permissions or limits.'); }
}
export const serializeWorkflowDefinition = (value: WorkflowDefinition): string => JSON.stringify(workflowDefinitionCheck(value), null, 2);
/** Design is a retained document, with no permission to edit the game repository. */
export function designWorkflowStep(settings: Settings): AiWorkflowStep {
  return { id: 'design', name: 'Design', kind: 'ai', output: 'design', access: 'readproject',
    ...stageAgent(settings, 'plan'), automatic: settings.automation.plan, minVotes: 0, inputs: ['plan'],
    instructions: 'Create a concrete design/specification for the captured request using the preceding implementation plan and the existing project. '
      + 'Describe intended behavior and user interactions where relevant, architecture and affected components, data contracts and compatibility, '
      + 'edge cases and failure/recovery behavior, and acceptance scenarios for Build to verify. Explain decisions, risks and unresolved questions; '
      + 'do not invent resolved product decisions. Keep the increment within the plan. Return the specification as Markdown for the Build step. '
      + 'Inspect project files read-only; do not implement changes.' };
}
export function defaultWorkflowDefinition(settings: Settings): WorkflowDefinition {
  const outputs: Record<typeof STAGES[number], WorkflowOutput> = { screen: 'screening', score: 'rice', plan: 'plan', implement: 'codechange' };
  const prompts = resolvedStagePrompts(settings.stagePrompts);
  const steps: WorkflowStep[] = STAGES.map(stage => ({ id: stage, name: STAGE_LABELS[stage], instructions: prompts[stage], kind: 'ai',
    output: outputs[stage], access: stage === 'implement' ? 'editworktree' : stage === 'plan' ? 'readproject' : 'none',
    ...stageAgent(settings, stage), automatic: settings.automation[stage], minVotes: stage === 'plan' ? settings.minVotes : 0 }));
  steps.splice(3, 0, designWorkflowStep(settings));
  const build = steps.find(step => step.id === 'implement');
  if (build?.kind === 'ai') {
    build.inputs = ['plan', 'design'];
    if (!settings.stagePrompts?.implement)
      build.instructions += '\n\nImplement the captured plan and Design specification supplied as preceding artifacts. Verify their acceptance scenarios and report unresolved gaps for human review.';
  }
  const value = { format: 'coforge-workflow/v1' as const, name: 'Community development', limits: { timeoutSeconds: settings.timeoutSeconds,
    maxTurns: settings.maxTurns, maxBudgetUsd: settings.maxBudgetUsd, intervalSeconds: settings.intervalSeconds }, steps };
  return workflowDefinitionCheck({ ...value, revision: `legacy-${contextEventId(JSON.stringify(value))}` });
}
export const workflowDefinition = (settings: Settings): WorkflowDefinition => settings.workflow ? workflowDefinitionCheck(settings.workflow) : defaultWorkflowDefinition(settings);
