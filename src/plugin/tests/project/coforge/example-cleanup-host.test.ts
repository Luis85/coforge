import { expect, it } from 'vitest';
import { assertExampleHostSettled } from '../../../features/coforge/application/example-cleanup-host';
import { emptyHerdr } from '../../../features/coforge/domain/herdr';
import type { HerdrWorkflowState } from '../../../features/coforge/application/herdr-workflow-ports';

const managed = (): HerdrWorkflowState => ({ records: [], ready: true, busy: false, error: '' });
it('rejects unconfirmed manual actions while leaving unrelated request history usable', () => {
  const manual = emptyHerdr();
  manual.records.push({ id: 'uncertain-1', kind: 'dispatch', ideaId: 'CF-101', projectId: 'CFP-001', session: 'default', at: '2026-10-28T10:00:00Z', status: 'uncertain' });
  expect(() => assertExampleHostSettled(['CF-101'], manual, managed(), [])).toThrow('unconfirmed');
  expect(() => assertExampleHostSettled(['CF-102'], manual, managed(), [])).not.toThrow();
  manual.records[0]!.status = 'delivered';
  expect(() => assertExampleHostSettled(['CF-101'], manual, managed(), [])).toThrow('Delivery');
  manual.records[0]!.status = 'reviewed';
  expect(() => assertExampleHostSettled(['CF-101'], manual, managed(), [])).not.toThrow();
});
it('does not allow cleanup before managed recovery journals are loaded', () => {
  expect(() => assertExampleHostSettled(['CF-101'], emptyHerdr(), { ...managed(), ready: false }, [])).toThrow('journals');
});
it('requires explicit Council settlement before deleting its idea subject', () => {
  const run = { subject: { kind: 'idea' as const, sourceId: 'note-1', revision: 'r1', markdown: 'A request', ideaId: 'CF-101' }, state: 'attention' as const, attempts: [] };
  expect(() => assertExampleHostSettled(['CF-101'], emptyHerdr(), managed(), [run])).toThrow('Council');
  expect(() => assertExampleHostSettled(['CF-102'], emptyHerdr(), managed(), [run])).not.toThrow();
});
