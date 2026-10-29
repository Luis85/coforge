// @vitest-environment happy-dom
import { createPinia, disposePinia } from 'pinia';
import { expect, it } from 'vitest';
import { useRequestFieldDrafts } from '../../../presentation/stores/coforge-request-field-drafts';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { createSeed } from '../../../features/coforge/domain/seed';

it('forgets only drafts for committed removed examples, preserving ordinary and restored request drafts', () => {
  const pinia = createPinia();
  const studio = useStudioStore(pinia);
  const fields = useRequestFieldDrafts(pinia);
  const state = createSeed();
  const removed = state.ideas[0]!.id; const restored = state.ideas[1]!.id;
  for (const id of [removed, restored, 'CF-999']) fields.drafts[id] = { values: { audience: `Authored draft for ${id}` }, savedValues: '', expected: 'captured', error: '', notice: '', working: false };
  try {
    studio.state = { ...state, ideas: state.ideas.filter(idea => idea.id !== removed) };
    expect(fields.drafts[removed]).toBeDefined();
    studio.state = { ...studio.state, exampleRemovalCutoffs: { [removed]: new Date().toISOString(), [restored]: new Date().toISOString() } };
    expect(fields.drafts[removed]).toBeUndefined();
    expect(fields.drafts[restored]?.values.audience).toContain('Authored draft');
    expect(fields.drafts['CF-999']?.values.audience).toContain('Authored draft');
  } finally { disposePinia(pinia); }
});
