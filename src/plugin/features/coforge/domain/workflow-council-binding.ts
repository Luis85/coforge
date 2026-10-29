import { list, oneOf, shape, text } from './check';

export interface CouncilTaskBinding {
  format: 'coforge-council-binding/v1';
  projectId: string;
  councilId: string;
  councilName: string;
  identity: string;
  members: { id: string; name: string; provider: 'demo' | 'claude' | 'herdr'; model: string }[];
}
export interface WorkflowCouncilBinding { stepId: string; binding: CouncilTaskBinding }
const id = text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u });
export const councilTaskBindingCheck = shape({
  format: oneOf(['coforge-council-binding/v1'] as const), projectId: id, councilId: id,
  councilName: text({ min: 1, max: 100 }), identity: id,
  members: list(shape({ id, name: text({ min: 1, max: 100 }), provider: oneOf(['demo', 'claude', 'herdr'] as const), model: text({ min: 1, max: 200 }) }, { strict: true }), { min: 1, max: 24 }),
}, { strict: true });
export const workflowCouncilBindingsCheck = list(shape({ stepId: id, binding: councilTaskBindingCheck }, { strict: true }), { max: 40 });
