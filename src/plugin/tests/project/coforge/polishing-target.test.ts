import { expect, it } from 'vitest';
import { selectPolishingTarget, polishingTargetCheck } from '../../../features/coforge/domain/polishing-target';
import { createSeed } from '../../../features/coforge/domain/seed';
import { retryFixture } from './background-build-retry-fixture';

it('captures an initial request without inventing a workflow or changing the canonical text', () => {
  const idea = createSeed().ideas.find(item => item.status === 'inbox')!;
  const original = structuredClone(idea); const target = selectPolishingTarget(idea);
  expect(target.kind).toBe('request'); expect(target.value.request).toEqual({ title: idea.title, description: idea.description });
  expect(target.sourceRunId).toBeUndefined(); expect(polishingTargetCheck(target)).toEqual(target); expect(idea).toEqual(original);
  const changed = selectPolishingTarget({ ...idea, description: 'Changed source request' }); expect(changed.contentHash).not.toBe(target.contentHash);
  expect(() => polishingTargetCheck({ ...target, contentHash: 'forged' })).toThrow();
});
it('selects actual retained partial code before earlier analytical results, including accepted code', async () => {
  const f = await retryFixture();
  try {
    const idea = f.current(); const target = selectPolishingTarget(idea);
    expect(target.kind).toBe('codechange'); expect(target.workspaceId).toBe('fg-original'); expect(target.value.increment).toEqual(idea.increment);
    expect(target.sourceRunId).toBe(idea.workflowRun?.id);
    expect(selectPolishingTarget({ ...idea, status: 'shipped' }).kind).toBe('codechange');
  } finally { await f.engine.stop(); }
});
it('selects the last valid completed typed result and rejects altered or mismatched payloads', async () => {
  const f = await retryFixture(false);
  try {
    const target = selectPolishingTarget(f.current()); expect(target.kind).toBe('design'); expect(target.value.markdown).toContain('Completed design');
    expect(() => polishingTargetCheck({ ...target, value: { plan: {} } })).toThrow();
    expect(() => polishingTargetCheck({ ...target, value: { ...target.value, request: { title: 'Another payload', description: 'Mismatch' } } })).toThrow();
    expect(() => polishingTargetCheck({ ...target, unexpectedAuthority: true })).toThrow();
  } finally { await f.engine.stop(); }
});
