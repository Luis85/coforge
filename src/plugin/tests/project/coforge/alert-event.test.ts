import { expect, it } from 'vitest';
import { publicAlertVariables } from '../../../features/coforge/application/alert-event';
import { createSeed } from '../../../features/coforge/domain/seed';
import type { StudioEvent } from '../../../features/coforge/application/studio-events';

it('ALERTS-05 suppresses private and simulated events and withholds unscreened request fields', () => {
  const state = createSeed();
  const idea = state.ideas.find(item => item.status === 'screened' && item.screening?.verdict === 'clear');
  if (!idea) throw new Error('Missing public fixture');
  const event: StudioEvent = { type: 'vote-counted', revision: 1, record: { code: 'vote-counted', at: new Date().toISOString(), effect: 'committed', sequence: 1, count: 1, entityId: idea.id } };
  const variables = publicAlertVariables(event, state);
  expect(variables?.request).toBe(idea.id); expect(variables?.title).toBe(idea.title);
  expect(variables).not.toHaveProperty('playerId'); expect(variables).not.toHaveProperty('entityId');
  idea.status = 'inbox'; expect(publicAlertVariables(event, state)).toEqual({ event: 'vote-counted', count: '1' });
  expect(publicAlertVariables({ ...event, record: { ...event.record, playerId: 'simulator:ada' } }, state)).toBeNull();
  idea.status = 'screened'; state.runtime.publicationDeniedProjectIds = [idea.projectId ?? 'CFP-001'];
  expect(publicAlertVariables(event, state)).toBeNull();
  expect(publicAlertVariables({ ...event, type: 'finance-entry-saved' }, state)).toBeNull();
  expect(publicAlertVariables({ ...event, record: { ...event.record, effect: 'uncertain' } }, state)).toBeNull();
});
