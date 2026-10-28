import type { HerdrState } from '../domain/herdr';
import type { RuntimeInfo } from '../domain/types';
import type { HerdrWorkflowState } from './herdr-workflow-ports';

/** Shared runtime facts for controls and dispatch; native identity is checked again before each mutation. */
export function herdrWorkflowReadiness(manual: HerdrState, workflow: HerdrWorkflowState, now: number): NonNullable<RuntimeInfo['herdrWorkflow']> {
  const busy = manual.busy || workflow.busy;
  if (!workflow.ready) return { ready: false, busy, message: 'Herdr workflow recovery is still loading or could not be read.' };
  if (manual.records.some(record => ['pending', 'uncertain'].includes(record.status)) ||
      workflow.records.some(record => !['completed', 'reviewed'].includes(record.phase)) && !workflow.busy)
    return { ready: false, busy, message: 'Inspect and acknowledge the original Herdr recovery records in Agent workflow before dispatching.' };
  if (manual.error || !manual.observation?.running || !manual.observation.compatible || !manual.checkedAt ||
      !Number.isFinite(Date.parse(manual.checkedAt)) || now - Date.parse(manual.checkedAt) > 30000)
    return { ready: false, busy, message: 'Refresh Herdr in Agent workflow and connect to a compatible running session.' };
  return { ready: true, busy, message: busy ? 'Herdr is handling an interaction.' : 'Herdr is connected. Each step launches a dedicated Claude agent.' };
}
