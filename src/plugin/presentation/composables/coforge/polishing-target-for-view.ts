import type { Idea } from '../../../features/coforge/domain/types';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import { workflowIncrementCheck, workflowPlanCheck, workflowRiceCheck, workflowScreeningCheck } from '../../../features/coforge/domain/configured-workflow-run';

/** Decode nested reactive values to plain contract data without losing dependency tracking or cloning history. */
export function polishingTargetForView(idea: Idea) {
  return selectPolishingTarget({ ...idea,
    ...(idea.increment ? { increment: workflowIncrementCheck(idea.increment) } : {}),
    ...(idea.plan ? { plan: workflowPlanCheck(idea.plan) } : {}),
    ...(idea.rice ? { rice: workflowRiceCheck(idea.rice) } : {}),
    ...(idea.screening ? { screening: workflowScreeningCheck(idea.screening) } : {}),
  });
}
