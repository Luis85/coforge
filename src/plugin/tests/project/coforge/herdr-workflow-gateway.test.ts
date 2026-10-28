import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HerdrWorkflowProfile } from '../../../features/coforge/application/herdr-workflow-ports';
import type { HerdrCommand } from '../../../infrastructure/coforge/herdr-gateway';
import { LocalHerdrWorkflowGateway } from '../../../infrastructure/coforge/herdr-workflow-gateway';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
const SESSION_ID = 'a1234567-1234-4567-89ab-123456789abc';
const nativeSession = (value = SESSION_ID) => ({ source: 'herdr:claude', agent: 'claude', kind: 'id', value });
async function fixture(sessionId?: string) {
  const cwd = await mkdtemp(join(tmpdir(), 'coforge-workflow-test-'));
  roots.push(cwd);
  const settings = { executable: 'herdr.exe', session: 'coforge' };
  const profile: HerdrWorkflowProfile = {
    name: 'cf-12345678', kind: 'claude', stage: 'screen', model: 'sonnet',
    resultPath: join(cwd, 'result.json'), systemPrompt: 'Trusted stage policy.', ...(sessionId ? { sessionId } : {}),
  };
  const pane = { pane_id: 'w1:p1', terminal_id: 't1', workspace_id: 'w1', cwd, agent: null };
  const initialSession: unknown = sessionId ? null : nativeSession('original');
  const agent = { ...pane, agent: 'claude', name: profile.name, agent_status: 'idle',
    interactive_ready: true, launch_pending: false, state_change_seq: 1, completion_seq: 0,
    agent_session: initialSession };
  const control = {
    status: { session: 'coforge', running: true, compatible: true, version: '0.9.5' },
    pane: { ...pane }, agent: { ...agent }, start: { ...agent }, prompted: { ...agent },
    argv: (args: string[]) => args, fail: '',
  };
  const calls: string[][] = [];
  const run = vi.fn<HerdrCommand>(async (_executable, args) => {
    calls.push([...args]);
    const [verb, action] = args.slice(2);
    if (`${verb} ${action}` === control.fail) throw new Error('private path and terminal output must not escape');
    if (verb === 'status') return JSON.stringify(control.status);
    const response = verb === 'workspace' ? { type: 'workspace_created', workspace: { workspace_id: 'w1', label: 'Task' }, root_pane: control.pane }
      : verb === 'pane' ? { type: 'pane_info', pane: control.pane }
      : action === 'start' ? { type: 'agent_started', agent: control.start, argv: control.argv(['claude', ...args.slice(args.indexOf('--') + 1)]) }
      : action === 'get' ? { type: 'agent_info', agent: control.agent }
      : { type: 'agent_prompted', agent: control.prompted };
    return JSON.stringify({ result: response });
  });
  const gateway = new LocalHerdrWorkflowGateway(run);
  async function start() {
    const { pane: target } = await gateway.createWorkspace(settings, cwd, 'Task');
    return gateway.startAgent(settings, target, profile);
  }
  return { cwd, settings, profile, control, calls, run, gateway, start };
}
const mutations = (calls: string[][]) => calls.filter((args) => ['create', 'start', 'prompt'].includes(args[3] ?? ''));

describe('dedicated native Herdr workflow protocol', () => {
  it('creates without focus, attests exact model and policy argv, and sends literal text once', async () => {
    const f = await fixture();
    const { agent, argv } = await f.start();
    const create = f.calls.find((args) => args[3] === 'create');
    expect(create).toEqual(['--session', 'coforge', 'workspace', 'create', '--cwd', await realpath(f.cwd), '--label', 'Task', '--no-focus']);
    const start = f.calls.find((args) => args[3] === 'start');
    expect(start?.slice(0, 12)).toEqual(['--session', 'coforge', 'agent', 'start', 'cf-12345678', '--kind', 'claude', '--pane', 'w1:p1', '--timeout', '30000', '--']);
    expect(argv[0]).toBe('claude');
    expect(argv[argv.indexOf('--model') + 1]).toBe('sonnet');
    expect(argv[argv.indexOf('--tools') + 1]).toBe('Write');
    const prompt = 'Task JSON\n$() and `literal quotes`';
    await f.gateway.sendPrompt(f.settings, agent, prompt);
    expect(f.calls.at(-1)).toEqual(['--session', 'coforge', 'agent', 'prompt', 'w1:p1', prompt]);
    await expect(f.gateway.sendPrompt(f.settings, agent, prompt)).rejects.toThrow('fresh');
    expect(mutations(f.calls)).toHaveLength(3);
    expect(f.calls.every((args) => args.slice(0, 2).join(' ') === '--session coforge')).toBe(true);
    expect(f.calls.some((args) => args.includes('focus') || args.includes('send-keys') || args.includes('wait') || args.includes('read'))).toBe(false);
    expect(f.run.mock.calls[0]?.[2]).toMatchObject({ cwd: tmpdir(), maxBytes: 1024 * 1024 });
    f.gateway.dispose();
  });

  it.each(['session', 'compatible', 'running'] as const)('refuses an incompatible %s before mutations', async (field) => {
    const f = await fixture();
    if (field === 'session') f.control.status.session = 'another'; else f.control.status[field] = false;
    await expect(f.start()).rejects.toThrow('configured compatible');
    expect(mutations(f.calls)).toHaveLength(0);
  });

  it('refuses a replacement empty pane without launching into it', async () => {
    const f = await fixture();
    const { pane } = await f.gateway.createWorkspace(f.settings, f.cwd, 'Task');
    f.control.pane.terminal_id = 'replacement';
    await expect(f.gateway.startAgent(f.settings, pane, f.profile)).rejects.toThrow('changed');
    expect(f.calls.filter((args) => args[3] === 'start')).toHaveLength(0);
  });

  it.each(['model', 'policy', 'extra'] as const)('rejects mismatched %s startup acknowledgement', async (change) => {
    const f = await fixture();
    f.control.argv = (argv) => change === 'model' ? argv.map((arg) => arg === 'sonnet' ? 'opus' : arg)
      : change === 'policy' ? argv.filter((arg) => arg !== '--restricted') : [...argv, '--dangerously-skip-permissions'];
    await expect(f.start()).rejects.toThrow('changed');
    expect(f.calls.filter((args) => args[3] === 'start')).toHaveLength(1);
    expect(f.calls.filter((args) => args[3] === 'prompt')).toHaveLength(0);
  });

  it('rejects a newly started target in another workspace or directory', async () => {
    const f = await fixture();
    f.control.start.workspace_id = 'other';
    await expect(f.start()).rejects.toThrow('changed');
    expect(f.calls.filter((args) => args[3] === 'start')).toHaveLength(1);
  });

  it('requires an explicit interactive-ready acknowledgement', async () => {
    const f = await fixture();
    f.control.start.interactive_ready = false;
    await expect(f.start()).rejects.toThrow('changed');
  });

  it.each(['identity', 'directory', 'working'] as const)('does not submit after %s changes', async (change) => {
    const f = await fixture();
    const { agent } = await f.start();
    if (change === 'identity') f.control.agent.agent_session = nativeSession('replacement');
    else if (change === 'directory') f.control.agent.cwd = tmpdir();
    else f.control.agent.agent_status = 'working';
    await expect(f.gateway.sendPrompt(f.settings, agent, 'Task')).rejects.toThrow();
    expect(f.calls.filter((args) => args[3] === 'prompt')).toHaveLength(0);
  });

  it('does not retry startup after an uncertain outcome or leak raw process errors', async () => {
    const f = await fixture();
    const { pane } = await f.gateway.createWorkspace(f.settings, f.cwd, 'Task');
    f.control.fail = 'agent start';
    await expect(f.gateway.startAgent(f.settings, pane, f.profile)).rejects.toThrow('did not confirm');
    await expect(f.gateway.startAgent(f.settings, pane, f.profile)).rejects.toThrow('changed');
    expect(f.calls.filter((args) => args[3] === 'start')).toHaveLength(1);
  });

  it('does not resend after uncertain prompt delivery', async () => {
    const f = await fixture();
    const { agent } = await f.start();
    f.control.fail = 'agent prompt';
    await expect(f.gateway.sendPrompt(f.settings, agent, 'Task')).rejects.toThrow('did not confirm');
    await expect(f.gateway.sendPrompt(f.settings, agent, 'Task')).rejects.toThrow('fresh');
    expect(f.calls.filter((args) => args[3] === 'prompt')).toHaveLength(1);
  });

  it('forbids prompting an existing unmanaged target even when its identity matches', async () => {
    const f = await fixture();
    const { agent } = await f.start();
    const anotherGateway = new LocalHerdrWorkflowGateway(f.run);
    await expect(anotherGateway.sendPrompt(f.settings, agent, 'Task')).rejects.toThrow('fresh');
    expect(f.calls.filter((args) => args[3] === 'prompt')).toHaveLength(0);
  });

  it('honors cancellation and disposal without issuing an external interrupt', async () => {
    const f = await fixture();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(f.gateway.createWorkspace(f.settings, f.cwd, 'Task', cancelled.signal)).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
    const { agent } = await f.start();
    f.gateway.dispose();
    await expect(f.gateway.inspectAgent(f.settings, agent)).rejects.toThrow();
    expect(f.calls.some((args) => args.includes('send-keys'))).toBe(false);
  });

  it('pins the requested conversation UUID and adopts matching native metadata exactly once', async () => {
    const f = await fixture(SESSION_ID);
    const { agent, argv } = await f.start();
    expect(argv[argv.indexOf('--session-id') + 1]).toBe(SESSION_ID);
    expect(agent.sessionRef).toBe('');
    expect((await f.gateway.inspectAgent(f.settings, agent)).sessionRef).toBe('');
    f.control.agent.agent_session = nativeSession();
    f.control.agent.state_change_seq = 3;
    f.control.agent.completion_seq = 1;
    const attested = await f.gateway.inspectAgent(f.settings, agent);
    expect(JSON.parse(attested.sessionRef)).toEqual(nativeSession());
    expect(attested).toMatchObject({ stateChangeSeq: 3, completionSeq: 1 });
    await expect(f.gateway.inspectAgent(f.settings, agent)).rejects.toThrow('changed');
    expect((await f.gateway.inspectAgent(f.settings, attested)).sessionRef).toBe(attested.sessionRef);
    f.control.agent.agent_session = nativeSession('b1234567-1234-4567-89ab-123456789abc');
    await expect(f.gateway.inspectAgent(f.settings, attested)).rejects.toThrow('changed');
    f.control.agent.agent_session = null;
    await expect(f.gateway.inspectAgent(f.settings, attested)).rejects.toThrow('changed');
  });

  it.each(['before-send', 'acknowledgement'] as const)('returns adopted identity when metadata arrives at %s', async (phase) => {
    const f = await fixture(SESSION_ID);
    const { agent } = await f.start();
    if (phase === 'before-send') f.control.agent.agent_session = nativeSession();
    f.control.prompted.agent_session = nativeSession();
    const delivered = await f.gateway.sendPrompt(f.settings, agent, 'Task');
    expect(JSON.parse(delivered.sessionRef)).toEqual(nativeSession());
    f.control.agent.agent_session = nativeSession();
    expect((await f.gateway.inspectAgent(f.settings, delivered)).sessionRef).toBe(delivered.sessionRef);
    await expect(f.gateway.sendPrompt(f.settings, delivered, 'Task')).rejects.toThrow('fresh');
    expect(f.calls.filter((args) => args[3] === 'prompt')).toHaveLength(1);
  });

  it.each(['source', 'agent', 'kind', 'value', 'extra'] as const)('rejects untrusted native metadata with different %s', async (field) => {
    const f = await fixture(SESSION_ID);
    const { agent } = await f.start();
    f.control.agent.agent_session = { ...nativeSession(), [field]: 'wrong' };
    await expect(f.gateway.inspectAgent(f.settings, agent)).rejects.toThrow('changed');
  });

  it('cannot adopt session metadata on a different terminal even when the UUID matches', async () => {
    const f = await fixture(SESSION_ID);
    const { agent } = await f.start();
    f.control.agent.agent_session = nativeSession();
    f.control.agent.terminal_id = 'replacement';
    await expect(f.gateway.inspectAgent(f.settings, agent)).rejects.toThrow('changed');
  });

  it('rejects a different conversation acknowledged at startup', async () => {
    const f = await fixture(SESSION_ID);
    f.control.start.agent_session = nativeSession('another');
    await expect(f.start()).rejects.toThrow('changed');
    expect(f.calls.filter((args) => args[3] === 'prompt')).toHaveLength(0);
  });

  it('never adopts late metadata without a pinned UUID', async () => {
    const f = await fixture();
    f.control.start.agent_session = null;
    const { agent } = await f.start();
    f.control.agent.agent_session = nativeSession();
    await expect(f.gateway.inspectAgent(f.settings, agent)).rejects.toThrow('changed');
  });
});
