import { expect, it } from 'vitest';
import type { AgentSessionEvent } from '../../../src/plugin/features/coforge/domain/agent-session';
import { verificationFixture } from './fixture';
import { inspectVerificationRuntime } from '../../../src/plugin/infrastructure/coforge/verification/runtime';

it('streams sanitized real container output before completion without changing command evidence', async () => {
  const f = await verificationFixture("console.log('LIVE_CONTAINER_OBSERVATION');console.log('Bearer PRIVATE_CONTAINER_TOKEN');setTimeout(()=>console.log('Command finished'),4000);", { maxRuns: 1, timeoutSeconds: 10 });
  const events: AgentSessionEvent[] = [];
  f.input.onSessionEvent = async event => { events.push(event); };
  const session = await f.open();
  let completed = false;
  const pending = session.run({ commandId: 'check' }).then(result => { completed = true; return result; });
  void pending.catch(() => undefined);
  await expect.poll(() => events.some(event => event.text?.includes('LIVE_CONTAINER_OBSERVATION')), { timeout: 15000 }).toBe(true);
  expect(completed).toBe(false);
  const runtime = f.currentRuntime(); if (!runtime) throw new Error('Original container identity missing.');
  const state = await inspectVerificationRuntime(runtime);
  expect(state === 'missing' ? false : state.State.Running).toBe(true);
  expect(f.records.at(-1)?.status).toBe('running');
  expect(JSON.stringify(events)).not.toContain('PRIVATE_CONTAINER_TOKEN');
  const result = await pending;
  expect(result).toMatchObject({ status: 'completed', exitCode: 0 });
  expect(result.output).toContain('Command finished');
  expect(result.output).not.toContain('PRIVATE_CONTAINER_TOKEN');
  expect(f.records.map(record => record.status)).toEqual(['running', 'completed']);
  await f.assertSourceUnchanged();
});
