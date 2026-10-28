import { expect, it } from 'vitest';
import { screeningProviderLabel } from '../../../presentation/composables/coforge/agent-labels';

it('attributes historical screening evidence to its provider rather than current project configuration', () => {
  expect(screeningProviderLabel('herdr')).toBe('Herdr · Claude Code screening');
  expect(screeningProviderLabel('claude')).toBe('Claude Code screening');
  expect(screeningProviderLabel('demo')).toBe('Simulated screening');
});
