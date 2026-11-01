import { expect, it } from 'vitest';
import { applyPolishingAmendment, effectivePolishingInputs } from '../../../features/coforge/application/polishing-amendments';
import { selectPolishingTarget } from '../../../features/coforge/domain/polishing-target';
import type { ImplementationPlan, RiceScore } from '../../../features/coforge/domain/types';
import { completedPolish } from './polishing-amendment-fixture';
import { seededStore } from './memory-storage';

const plan: ImplementationPlan = { summary: 'Original plan', steps: ['Implement the current request'], acceptanceCriteria: ['Verify the behavior'], risks: [], markdown: '# Original plan', createdAt: '2026-10-31T10:00:00Z' };
const rice: RiceScore = { reach: 4, impact: 1, confidence: 0.5, effort: 2, score: 1, rationale: 'Original estimate' };
const cases: Array<{ kind: 'plan' | 'rice'; before: { plan?: ImplementationPlan; rice?: RiceScore }; after: { plan?: ImplementationPlan; rice?: RiceScore } }> = [
  { kind: 'plan', before: { plan }, after: { plan: { ...plan, summary: 'Reviewed plan', steps: ['Implement', 'Check recovery'], markdown: '# Reviewed plan' } } },
  { kind: 'rice', before: { rice }, after: { rice: { ...rice, reach: 8, score: 2, rationale: 'Reviewed estimate' } } },
];
it.each(cases)('retains genuine approved $kind versions and their typed compatibility across a second pass', async ({ kind, before, after }) => {
  const { store } = await seededStore(); const state = store.internalSnapshot(); const idea = state.ideas.find(item => item.status === 'inbox')!;
  Object.assign(idea, structuredClone(before)); const original = structuredClone(before);
  const first = completedPolish(idea, after); expect(first.target.kind).toBe(kind);
  expect(selectPolishingTarget(idea).value[kind]).toEqual(before[kind]);
  applyPolishingAmendment(state, idea.id, first.id, first.workflow.revision);
  expect(idea[kind]).toEqual(after[kind]); expect(before).toEqual(original);
  expect(selectPolishingTarget(idea)).toMatchObject({ sourceArtifactId: first.workflow.artifacts[0]!.id, sourceRunId: first.id });
  const next = completedPolish(idea, before); expect(next.target.value[kind]).toEqual(after[kind]);
  applyPolishingAmendment(state, idea.id, next.id, next.workflow.revision);
  expect(selectPolishingTarget(idea).value[kind]).toEqual(before[kind]); expect(idea.polishingAmendments).toHaveLength(2);
  expect(first.workflow.artifacts[0]?.[kind]).toEqual(after[kind]);
});
it('retains Markdown progress and supplies the genuine reviewed auxiliary Markdown as the next input', async () => {
  const { store } = await seededStore(); const state = store.internalSnapshot(); const idea = state.ideas.find(item => item.status === 'inbox')!;
  const initial = completedPolish(idea, { markdown: '# Original analysis' });
  idea.workflowRun = structuredClone(initial.workflow); delete idea.polishingRuns;
  const main = structuredClone(idea.workflowRun); expect(selectPolishingTarget(idea).kind).toBe('markdown');
  const pass = completedPolish(idea, { markdown: '# Reviewed analysis' });
  applyPolishingAmendment(state, idea.id, pass.id, pass.workflow.revision);
  expect(idea.workflowRun).toEqual(main); expect(selectPolishingTarget(idea).value.markdown).toBe('# Reviewed analysis');
  expect(effectivePolishingInputs(idea, idea.workflowRun, idea.workflowRun.artifacts)).toEqual(pass.workflow.artifacts);
});
