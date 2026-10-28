import { describe, expect, it, vi } from 'vitest';
import { HerdrAdmission } from '../../../features/coforge/application/herdr-admission';
import { HerdrService } from '../../../features/coforge/application/herdr-service';
import { HerdrWorkflowService } from '../../../features/coforge/application/herdr-workflow-service';
import type { HerdrGateway } from '../../../features/coforge/application/herdr-ports';
import type { HerdrAttemptFiles, HerdrWorkflowGateway, HerdrWorkflowRecord, HerdrWorkflowStorage } from '../../../features/coforge/application/herdr-workflow-ports';
import type { StageInput, Timers } from '../../../features/coforge/application/ports';
import { emptyHerdr } from '../../../features/coforge/domain/herdr';
import { HERDR_RESULT_FORMAT } from '../../../features/coforge/application/herdr-result';
import { seededStore } from './memory-storage';

const JOB = 'f1234567-1234-4567-89ab-123456789abc';
async function fixture(start = true) {
  const { store } = await seededStore();
  const idea = store.snapshot().ideas.find(idea => idea.status === 'inbox')!;
  const input: StageInput = { jobId: JOB, idea, stage: 'screen', settings: { ...store.snapshot().settings, provider: 'herdr', model: 'sonnet', timeoutSeconds: 15 }, integration: store.integrationSnapshot() };
  const admission = new HerdrAdmission();
  let now = Date.now();
  let id = 0;
  const clock = { now: () => now, id: () => `a1234567-1234-4567-89ab-${String(++id).padStart(12, '0')}` };
  const pending = new Map<number, { due: number; callback: () => void }>();
  const advance = (ms: number) => {
    now += ms;
    for (const [handle, timer] of pending) if (timer.due <= now) { pending.delete(handle); timer.callback(); }
  };
  const timers: Timers = {
    setTimeout: (callback, ms) => { const handle = ++id; pending.set(handle, { due: now + ms, callback }); if (ms <= 500) queueMicrotask(() => advance(ms)); return handle; },
    clearTimeout: handle => { pending.delete(handle); }, setInterval: () => ++id, clearInterval: () => {},
  };
  const pane = { id: 'w1:p1', terminalId: 't1', workspaceId: 'w1', cwd: '/private/attempt', agent: '' };
  const agent = { paneId: pane.id, terminalId: pane.terminalId, workspaceId: pane.workspaceId, cwd: pane.cwd, agent: 'claude', name: 'cf-test', ready: true, status: 'idle', sessionRef: '', completionSeq: 0 };
  const manualGateway: HerdrGateway = {
    read: async () => ({ running: true, compatible: true, version: '0.9.5', workspaces: [], panes: [], agents: [agent] }),
    sameDirectory: async (left, right) => left === right, createWorkspace: async () => {}, startAgent: async () => {},
    focus: async () => {}, interrupt: async () => {}, send: async () => {}, dispose: () => {},
  };
  const manual = new HerdrService(store, manualGateway, { load: async () => ({ settings: emptyHerdr().settings, records: [] }), save: async () => {} }, undefined, admission);
  await manual.start();
  const control = { records: [] as HerdrWorkflowRecord[], failPhase: '', loadFail: false, mode: 'busy-ready', invalid: '', cancel: undefined as AbortController | undefined };
  const storage: HerdrWorkflowStorage = {
    load: async () => { if (control.loadFail) throw new Error('private data'); return structuredClone(control.records); },
    save: async records => { if (records.at(-1)?.phase === control.failPhase) throw new Error('private write failure'); control.records = structuredClone(records); },
  };
  const phases: string[] = [];
  let inspected = 0;
  const gateway: HerdrWorkflowGateway = {
    createWorkspace: vi.fn(async () => { phases.push(control.records.at(-1)!.phase); return { workspace: { id: 'w1', name: 'Task', cwd: pane.cwd }, pane }; }),
    startAgent: vi.fn(async (_settings, _pane, profile) => { phases.push(control.records.at(-1)!.phase); expect(profile.sessionId).toBe(JOB); return { agent, argv: ['claude', '--model', profile.model, '--session-id', JOB] }; }),
    sendPrompt: vi.fn(async (_settings, target, prompt) => { phases.push(control.records.at(-1)!.phase); expect(prompt).toContain(HERDR_RESULT_FORMAT); control.cancel?.abort(); return target; }),
    inspectAgent: vi.fn(async (_settings, target) => {
      inspected++;
      return control.mode === 'always-ready' ? { ...target, status: 'idle' }
        : control.mode === 'sequence' ? { ...target, status: 'idle', completionSeq: 1 }
        : { ...target, status: inspected === 1 ? 'working' : 'idle' };
    }),
    dispose: vi.fn(),
  };
  const area = {
    cwd: pane.cwd, resultPath: `${pane.cwd}/result.json`,
    readResult: vi.fn(async () => {
      const record = control.records.at(-1)!;
      if (control.invalid === 'echo') return 'An echoed task template is not an object.';
      return { format: HERDR_RESULT_FORMAT, attemptId: record.id, jobId: record.jobId, ideaId: record.ideaId, projectId: record.projectId,
        stage: record.stage, fingerprint: record.fingerprint, nonce: control.invalid === 'nonce' ? 'wrong' : record.nonce,
        output: { verdict: 'clear', reason: 'A game feature.', signals: [] } };
    }),
    finish: vi.fn(async () => ({ screening: { verdict: 'clear' as const, reason: 'A game feature.', signals: [], checkedAt: new Date(now).toISOString(), provider: 'herdr' as const }, costUsd: 999, usage: { inputTokens: 999 } })),
    dispose: vi.fn(async () => {}),
  };
  const files: HerdrAttemptFiles = { prepare: vi.fn(async () => area) };
  const service = new HerdrWorkflowService(store, manual, admission, storage, gateway, files, timers, clock);
  if (start) await service.start();
  return { service, manual, admission, storage, gateway, files, area, input, control, phases, store, timers, clock, advance };
}

describe('automatic Herdr workflow orchestration', () => {
  it('journals every mutation before delivery and commits verified completion before returning', async () => {
    const f = await fixture();
    const result = await f.service.run(f.input);
    expect(f.phases).toEqual(['creating-workspace', 'starting-agent', 'sending-prompt']);
    expect(f.control.records.at(-1)).toMatchObject({ phase: 'completed', model: 'sonnet', kind: 'claude', configuration: { sessionId: JOB } });
    expect(f.control.records.at(-1)?.launchArgv).toContain('--model');
    expect(result.screening?.provider).toBe('herdr');
    expect(result.costUsd).toBeUndefined();
    expect(result.usage).toBeUndefined();
    expect(f.area.finish).toHaveBeenCalledOnce();
    expect(f.store.snapshot().ideas.find(idea => idea.id === f.input.idea.id)?.screening).toEqual(f.input.idea.screening);
    await f.manual.configure({ executable: 'new-herdr', session: 'default' });
  });

  it('also accepts a correlated artifact after completion sequence advancement', async () => {
    const f = await fixture();
    f.control.mode = 'sequence';
    expect((await f.service.run(f.input)).screening?.verdict).toBe('clear');
  });

  it('recognizes a fast completion that already advanced before prompt acknowledgement', async () => {
    const f = await fixture();
    const send = f.gateway.sendPrompt;
    f.gateway.sendPrompt = async (...args) => ({ ...await send(...args), status: 'done', completionSeq: 1 });
    f.control.mode = 'sequence';
    expect((await f.service.run(f.input)).screening?.verdict).toBe('clear');
    expect(f.control.records.at(-1)?.phase).toBe('completed');
  });

  it('does not treat a ready agent and a valid-looking artifact as successful completion', async () => {
    const f = await fixture();
    f.control.mode = 'always-ready';
    await expect(f.service.run(f.input)).rejects.toThrow('attention');
    expect(f.area.readResult).not.toHaveBeenCalled();
    expect(f.control.records.at(-1)?.phase).toBe('attention');
    expect(f.gateway.sendPrompt).toHaveBeenCalledOnce();
    await expect(f.manual.configure({ executable: 'herdr', session: 'default' })).rejects.toThrow('attention');
  });

  it.each(['echo', 'nonce'])('rejects %s artifacts without advancing or trusting reported costs', async invalid => {
    const f = await fixture();
    f.control.invalid = invalid;
    await expect(f.service.run(f.input)).rejects.toThrow('attention');
    expect(f.area.finish).not.toHaveBeenCalled();
    expect(f.control.records.at(-1)?.phase).toBe('attention');
  });

  it('does not deliver a prompt if post-start journal persistence fails', async () => {
    const f = await fixture();
    f.control.failPhase = 'agent-ready';
    await expect(f.service.run(f.input)).rejects.toThrow('attention');
    expect(f.gateway.startAgent).toHaveBeenCalledOnce();
    expect(f.gateway.sendPrompt).not.toHaveBeenCalled();
    expect(f.control.records.at(-1)).toMatchObject({ phase: 'attention', target: { paneId: 'w1:p1' }, launchArgv: ['claude', '--model', 'sonnet', '--session-id', JOB] });
  });

  it('does not return a result before the completed journal write succeeds', async () => {
    const f = await fixture();
    f.control.failPhase = 'completed';
    await expect(f.service.run(f.input)).rejects.toThrow('attention');
    expect(f.control.records.at(-1)?.phase).toBe('attention');
    await expect(f.service.run(f.input)).rejects.toThrow('attention');
    expect(f.gateway.sendPrompt).toHaveBeenCalledOnce();
  });

  it('cancellation preserves the original resources and never interrupts or resends', async () => {
    const f = await fixture();
    const cancellation = new AbortController();
    f.control.cancel = cancellation;
    await expect(f.service.run({ ...f.input, signal: cancellation.signal })).rejects.toThrow('attention');
    expect(f.control.records.at(-1)).toMatchObject({ phase: 'attention', target: { paneId: 'w1:p1' }, resultPath: '/private/attempt/result.json' });
    expect(f.area.dispose).toHaveBeenCalledOnce();
    expect(f.gateway.sendPrompt).toHaveBeenCalledOnce();
    expect(f.gateway.dispose).not.toHaveBeenCalled();
  });

  it('blocks manual mutation/configuration until both journals load successfully', async () => {
    const f = await fixture(false);
    await expect(f.manual.configure({ executable: 'herdr', session: 'default' })).rejects.toThrow('Both');
    f.control.loadFail = true;
    await expect(f.service.start()).rejects.toThrow('journal');
    await expect(f.manual.configure({ executable: 'herdr', session: 'default' })).rejects.toThrow('Both');
    expect(f.gateway.createWorkspace).not.toHaveBeenCalled();
  });

  it('requires explicit inspection before acknowledging uncertainty, without claiming completion', async () => {
    const f = await fixture();
    f.control.invalid = 'nonce';
    await expect(f.service.run(f.input)).rejects.toThrow();
    const id = f.control.records.at(-1)!.id;
    await expect(f.service.acknowledge(id)).rejects.toThrow('Inspect');
    await f.service.inspect(id);
    expect(f.service.snapshot().records.at(-1)?.inspection).toBe('original-target');
    await f.service.acknowledge(id);
    expect(f.control.records.at(-1)?.phase).toBe('reviewed');
    expect(f.area.finish).not.toHaveBeenCalled();
    await f.manual.configure({ executable: 'herdr', session: 'default' });
  });

  it('reload converts interrupted work to attention and never resumes external delivery', async () => {
    const f = await fixture();
    f.control.mode = 'always-ready';
    await expect(f.service.run(f.input)).rejects.toThrow();
    f.control.records[0]!.phase = 'waiting-result';
    const restarted = new HerdrWorkflowService(f.store, f.manual, f.admission, f.storage, f.gateway, f.files, f.timers, f.clock);
    await restarted.start();
    expect(restarted.snapshot().records[0]?.phase).toBe('attention');
    expect(f.gateway.sendPrompt).toHaveBeenCalledOnce();
    await expect(restarted.run(f.input)).rejects.toThrow('attention');
  });

  it('rejects changed request content before consuming the agent result', async () => {
    const f = await fixture();
    const inspect = f.gateway.inspectAgent;
    f.gateway.inspectAgent = async (...args) => {
      await f.store.transaction(state => { state.ideas.find(idea => idea.id === f.input.idea.id)!.description += ' changed'; });
      return inspect(...args);
    };
    await expect(f.service.run(f.input)).rejects.toThrow('attention');
    expect(f.area.finish).not.toHaveBeenCalled();
  });

  it('bounds an abort-ignoring external call with the configured deadline and preserves uncertainty', async () => {
    const f = await fixture();
    let entered: () => void = () => {};
    const enteredCall = new Promise<void>(resolve => { entered = resolve; });
    let suppliedSignal: AbortSignal | undefined;
    f.gateway.createWorkspace = async (_settings, _cwd, _label, signal) => {
      suppliedSignal = signal;
      entered();
      return new Promise(() => {});
    };
    const result = f.service.run(f.input);
    await enteredCall;
    f.advance(15000);
    await expect(result).rejects.toThrow('attention');
    expect(suppliedSignal?.aborted).toBe(true);
    expect(f.control.records.at(-1)?.phase).toBe('attention');
    expect(f.gateway.startAgent).not.toHaveBeenCalled();
    await expect(f.manual.configure({ executable: 'herdr', session: 'default' })).rejects.toThrow('attention');
  });

  it('blocks manual changes and another workflow for the entire external attempt', async () => {
    const f = await fixture();
    const create = f.gateway.createWorkspace;
    f.gateway.createWorkspace = async (...args) => {
      await expect(f.manual.configure({ executable: 'another-herdr', session: 'default' })).rejects.toThrow('active');
      await expect(f.service.run(f.input)).rejects.toThrow('active');
      return create(...args);
    };
    expect((await f.service.run(f.input)).screening?.verdict).toBe('clear');
  });

  it('preserves completed evidence and returns the verified result if only operation logging fails', async () => {
    const f = await fixture();
    const transaction = f.store.transaction.bind(f.store);
    let calls = 0;
    f.store.transaction = async (...args) => {
      if (++calls === 2) throw new Error('Log unavailable');
      return transaction(...args);
    };
    expect((await f.service.run(f.input)).screening?.verdict).toBe('clear');
    expect(f.control.records.at(-1)?.phase).toBe('completed');
    expect(f.service.snapshot().error).toContain('operation log');
  });
});
