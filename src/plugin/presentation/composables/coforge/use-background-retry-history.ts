import { computed, reactive } from 'vue';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { retryDeadline, retryIdleWarning } from './background-build-retry-display';

export function useBackgroundRetryHistory(run: () => WorkflowRun) {
  return reactive({ approvals: computed(() => (run().backgroundRetries ?? []).map(approval => ({
    ...approval, stepName: run().definition.steps.find(step => step.id === approval.stepId)?.name ?? approval.stepId,
    time: new Date(approval.approvedAt).toLocaleString(), deadline: retryDeadline(approval.policy), idle: retryIdleWarning(approval.policy),
    turns: approval.policy.maxTurns ?? run().definition.limits.maxTurns,
    budget: approval.policy.maxBudgetUsd ?? run().definition.limits.maxBudgetUsd,
  }))) });
}
