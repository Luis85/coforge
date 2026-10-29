import { describe, expect, it } from 'vitest';
import { StructuredLogger } from '../../../application/logging';
import { operationsLog } from '../../../infrastructure/coforge/operations-log';

describe('Twitch operation diagnostics', () => {
  it('registers bounded catalogues and records only declared aggregate metadata', () => {
    const logger = new StructuredLogger({ report: () => {} }, () => '2026-10-29T12:00:00Z');
    const log = operationsLog(logger);
    log.record({ code: 'twitch-operation-confirmed', at: '2026-10-29T12:00:00Z', sequence: 1, count: 1, effect: 'committed', entityId: 'private-action-id' });
    expect(log.snapshot()).toEqual([expect.objectContaining({ code: 'coforge.twitch.twitch-operation-confirmed', operation: 'coforge.twitch.twitch', metadata: { count: 1, effect: 'committed', correlation: expect.any(Number) } })]);
    expect(JSON.stringify(log.snapshot())).not.toContain('private-action-id');
    expect(logger.statistics.rejected).toBe(0);
  });
});
