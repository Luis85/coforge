import { expect, it } from 'vitest';
import { integrationPatch } from '../../../features/coforge/domain/inputs';
import { defaultIntegration } from '../../../features/coforge/domain/seed';

it('keeps a separate native Node executable setting and preserves legacy provider configuration', () => {
  expect(integrationPatch({ workerNodeBin: '  C:/Program Files/nodejs/node.exe  ' })).toEqual({ workerNodeBin: 'C:/Program Files/nodejs/node.exe' });
  expect(defaultIntegration()).toMatchObject({ workerNodeBin: 'node', claudeBin: 'claude', codexBin: 'codex' });
  expect(integrationPatch({})).toEqual({});
});

it('rejects empty or oversized background-worker executables before saving', () => {
  expect(() => integrationPatch({ workerNodeBin: '   ' })).toThrow();
  expect(() => integrationPatch({ workerNodeBin: 'n'.repeat(1001) })).toThrow();
});
