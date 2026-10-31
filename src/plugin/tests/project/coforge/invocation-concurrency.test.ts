import { expect, it, vi } from 'vitest';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';

function deferred() { let resolve = () => {}; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

it('runs configured short-task slots in FIFO order and lowering the cap leaves active work alive', async () => {
  const gate = new InvocationGate(); const a = deferred(); const b = deferred(); const c = deferred(); const started: string[] = [];
  gate.setConcurrency(2);
  const first = gate.run(async () => { started.push('a'); await a.promise; });
  const second = gate.run(async () => { started.push('b'); await b.promise; });
  const third = gate.run(async () => { started.push('c'); await c.promise; });
  try {
    await vi.waitFor(() => expect(started).toEqual(['a', 'b']));
    gate.setConcurrency(1);
    a.resolve(); await first;
    expect(started).toEqual(['a', 'b']);
    b.resolve(); await second;
    await vi.waitFor(() => expect(started).toEqual(['a', 'b', 'c']));
    c.resolve(); await third;
  } finally { a.resolve(); b.resolve(); c.resolve(); await Promise.allSettled([first, second, third]); gate.dispose(); }
});

it('raising the cap admits queued work without waiting for the first task to finish', async () => {
  const gate = new InvocationGate(); const a = deferred(); const b = deferred(); const started: string[] = [];
  const first = gate.run(async () => { started.push('a'); await a.promise; });
  const second = gate.run(async () => { started.push('b'); await b.promise; });
  try {
    await vi.waitFor(() => expect(started).toEqual(['a']));
    gate.setConcurrency(2);
    await vi.waitFor(() => expect(started).toEqual(['a', 'b']));
  } finally { a.resolve(); b.resolve(); await Promise.allSettled([first, second]); gate.dispose(); }
});
