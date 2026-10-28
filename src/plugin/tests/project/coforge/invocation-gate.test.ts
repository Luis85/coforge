import { describe, expect, it } from 'vitest';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';

describe('shared provider invocation boundary', () => {
  it('serializes legacy and typed calls fairly and releases the slot after failure', async () => {
    const gate = new InvocationGate();
    const events: string[] = [];
    let release = () => {};
    const hold = new Promise<void>(resolve => { release = resolve; });
    const first = gate.run(async () => { events.push('v1'); await hold; });
    const failed = gate.run(async () => { events.push('council'); throw new Error('provider failed'); });
    const last = gate.run(async () => { events.push('direct'); return 3; });
    await Promise.resolve();
    expect(events).toEqual(['v1']);
    release();
    await first;
    await expect(failed).rejects.toThrow('provider failed');
    expect(await last).toBe(3);
    expect(events).toEqual(['v1', 'council', 'direct']);
  });

  it('does not invoke a cancelled waiter and stops admitting calls on disposal', async () => {
    const gate = new InvocationGate();
    let release = () => {};
    const hold = new Promise<void>(resolve => { release = resolve; });
    const first = gate.run(async () => { await hold; });
    const controller = new AbortController();
    let calls = 0;
    const waiting = gate.run(async () => { calls++; }, controller.signal);
    controller.abort();
    release();
    await first;
    await expect(waiting).rejects.toThrow();
    expect(calls).toBe(0);
    gate.dispose();
    await expect(gate.run(async () => { calls++; })).rejects.toThrow('unloaded');
    expect(calls).toBe(0);
  });
});
