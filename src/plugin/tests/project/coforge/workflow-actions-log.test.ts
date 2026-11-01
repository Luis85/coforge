import { expect, it } from 'vitest';
import { StructuredLogger } from '../../../application/logging';
import { operationsLog } from '../../../infrastructure/coforge/operations-log';

it('registers bounded workflow-action diagnostics and records new actions without exposing target identities', () => {
  const logger = new StructuredLogger({ report: () => {} }, () => '2026-10-31T12:00:00Z'); const log = operationsLog(logger);
  const codes = ['workflow-background-retry-approved', 'polishing-pass-approved', 'polishing-pass-stopped', 'polishing-result-rejected'] as const;
  codes.forEach((code, index) => log.record({ code, at: '2026-10-31T12:00:00Z', sequence: index + 1, count: 1, effect: 'committed', entityId: 'private-result-identity' }));
  expect(log.snapshot().map(record => record.code)).toEqual(codes.map(code => `coforge.workflow-actions.${code}`));
  expect(log.snapshot().every(record => record.operation === 'coforge.workflow-actions.workflow')).toBe(true);
  expect(logger.statistics.rejected).toBe(0); expect(JSON.stringify(log.snapshot())).not.toContain('private-result-identity');
});
