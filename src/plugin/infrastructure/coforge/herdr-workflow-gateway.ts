import { tmpdir } from 'node:os';
import type { HerdrWorkflowGateway, HerdrWorkflowProfile, HerdrWorkflowTarget } from '../../features/coforge/application/herdr-workflow-ports';
import { record } from '../../features/coforge/domain/check';
import { herdrReady, sameHerdrAgent, type HerdrPane, type HerdrSettings } from '../../features/coforge/domain/herdr';
import type { HerdrCommand } from './herdr-gateway';
import { decodeHerdrAgent, decodeHerdrPane, decodeHerdrWorkspace, herdrId, herdrResult } from './herdr-protocol';
import { buildHerdrWorkflowArgs, canonicalHerdrDirectory, sameHerdrDirectory } from './herdr-workflow-profile';
import { captureProcess } from './process';

const uncertain = () => new Error('Herdr did not confirm this workflow operation. Inspect the original session and recover it before trying again.');
const identityChanged = () => new Error('The dedicated Herdr target or its directory changed. Inspect the original session.');
const key = (settings: HerdrSettings, paneId: string) => JSON.stringify([settings.executable, settings.session, paneId]);
interface ManagedTarget { target: HerdrWorkflowTarget; sessionId?: string; mayAdopt: boolean; fresh: boolean }

function workflowTarget(value: unknown): HerdrWorkflowTarget {
  const raw = record(value);
  const sequence = (field: string) => {
    const value = raw[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) throw identityChanged();
    return typeof value === 'number' ? value : undefined;
  };
  const stateChangeSeq = sequence('state_change_seq');
  const completionSeq = sequence('completion_seq');
  return { ...decodeHerdrAgent(value), ...(stateChangeSeq !== undefined ? { stateChangeSeq } : {}), ...(completionSeq !== undefined ? { completionSeq } : {}) };
}

function matchingClaudeSession(value: unknown, sessionId: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = record(value);
  return Object.keys(session).length === 4 && session.source === 'herdr:claude' && session.agent === 'claude' &&
    session.kind === 'id' && session.value === sessionId;
}

/** Dedicated managed targets only. Admission/journaling belongs to the shared application service. */
export class LocalHerdrWorkflowGateway implements HerdrWorkflowGateway {
  private readonly cancellation = new AbortController();
  private readonly workspaces = new Map<string, HerdrPane>();
  private readonly managed = new Map<string, ManagedTarget>();
  constructor(private readonly run: HerdrCommand = captureProcess) {}

  private async command(settings: HerdrSettings, args: string[], signal?: AbortSignal, timeoutMs = 10000): Promise<string> {
    const complete = ['--session', settings.session, ...args];
    if (!settings.executable.trim() || /\.(cmd|bat)$/iu.test(settings.executable) || /\p{Cc}/u.test(settings.executable) ||
        !/^[a-zA-Z0-9_-]{1,80}$/u.test(settings.session) || args.some((arg) => arg.includes('\0')) ||
        settings.executable.length + complete.reduce((size, arg) => size + arg.length * 2 + 3, 0) > 30000)
      throw new Error('Use a native Herdr executable, valid session and bounded workflow configuration.');
    const cancellation = AbortSignal.any([this.cancellation.signal, ...(signal ? [signal] : [])]);
    if (cancellation.aborted) throw uncertain();
    try {
      return await this.run(settings.executable, complete, { cwd: tmpdir(), signal: cancellation, timeoutMs, maxBytes: 1024 * 1024 });
    } catch { throw uncertain(); }
  }

  private async stable(settings: HerdrSettings, signal?: AbortSignal): Promise<void> {
    try {
      const status = record(JSON.parse(await this.command(settings, ['status', 'server', '--json'], signal)));
      if (status.session !== settings.session || status.running !== true || status.compatible !== true || typeof status.version !== 'string')
        throw uncertain();
    } catch { throw new Error('Connect the configured compatible running Herdr session before dispatching a workflow.'); }
  }

  private async result(settings: HerdrSettings, args: string[], type: string, signal?: AbortSignal, timeoutMs?: number) {
    try { return herdrResult(await this.command(settings, args, signal, timeoutMs), type); }
    catch { throw uncertain(); }
  }

  async createWorkspace(settings: HerdrSettings, cwd: string, label: string, signal?: AbortSignal) {
    const canonical = await canonicalHerdrDirectory(cwd);
    if (!label.trim() || label.length > 80 || label.startsWith('-') || /\p{Cc}/u.test(label))
      throw new Error('Choose a bounded dedicated Herdr workspace label.');
    await this.stable(settings, signal);
    const result = await this.result(settings,
      ['workspace', 'create', '--cwd', canonical, '--label', label, '--no-focus'], 'workspace_created', signal);
    const pane = decodeHerdrPane(result.root_pane);
    const workspace = decodeHerdrWorkspace(result.workspace, [pane]);
    if (workspace.id !== pane.workspaceId || pane.agent ||
        !(await sameHerdrDirectory(canonical, pane.cwd)) || !(await sameHerdrDirectory(canonical, workspace.cwd))) throw identityChanged();
    this.workspaces.set(key(settings, pane.id), pane);
    return { workspace, pane };
  }

  async startAgent(settings: HerdrSettings, expected: HerdrPane, profile: HerdrWorkflowProfile, signal?: AbortSignal) {
    const args = await buildHerdrWorkflowArgs(expected.cwd, profile);
    const identity = key(settings, expected.id);
    const owned = this.workspaces.get(identity);
    if (!owned || owned.terminalId !== expected.terminalId || owned.workspaceId !== expected.workspaceId ||
        !(await sameHerdrDirectory(owned.cwd, expected.cwd))) throw identityChanged();
    await this.stable(settings, signal);
    const pane = decodeHerdrPane((await this.result(settings, ['pane', 'get', herdrId(expected.id)], 'pane_info', signal)).pane);
    if (pane.id !== expected.id || pane.terminalId !== expected.terminalId || pane.workspaceId !== expected.workspaceId ||
        pane.agent || !(await sameHerdrDirectory(expected.cwd, pane.cwd))) throw identityChanged();
    // Consume ownership before sending: timeout/failed acknowledgement must never replay startup.
    this.workspaces.delete(identity);
    const result = await this.result(settings,
      ['agent', 'start', profile.name, '--kind', profile.kind, '--pane', pane.id, '--timeout', '30000', '--', ...args],
      'agent_started', signal, 45000);
    const agent = workflowTarget(result.agent);
    const raw = record(result.agent);
    const argv = result.argv;
    const expectedArgv = [profile.kind, ...args];
    if (!Array.isArray(argv) || argv.length !== expectedArgv.length || !argv.every((value, i) => value === expectedArgv[i]) ||
        agent.paneId !== pane.id || agent.terminalId !== pane.terminalId || agent.workspaceId !== pane.workspaceId ||
        agent.agent !== profile.kind || agent.name !== profile.name || raw.interactive_ready !== true ||
        !herdrReady(agent) || !(await sameHerdrDirectory(pane.cwd, agent.cwd))) throw identityChanged();
    if (profile.sessionId && agent.sessionRef && !matchingClaudeSession(raw.agent_session, profile.sessionId)) throw identityChanged();
    this.managed.set(identity, { target: agent, ...(profile.sessionId ? { sessionId: profile.sessionId } : {}), mayAdopt: !agent.sessionRef, fresh: true });
    return { agent, argv: expectedArgv };
  }

  async inspectAgent(settings: HerdrSettings, target: HerdrWorkflowTarget, signal?: AbortSignal): Promise<HerdrWorkflowTarget> {
    await this.stable(settings, signal);
    const raw = (await this.result(settings, ['agent', 'get', herdrId(target.paneId)], 'agent_info', signal)).agent;
    return this.verifyIdentity(settings, target, raw);
  }

  private async verifyIdentity(settings: HerdrSettings, target: HerdrWorkflowTarget, raw: unknown): Promise<HerdrWorkflowTarget> {
    const current = workflowTarget(raw);
    const managed = this.managed.get(key(settings, target.paneId));
    if (!sameHerdrAgent({ ...current, sessionRef: target.sessionRef }, target) || current.name !== target.name ||
        record(raw).interactive_ready !== true || !(await sameHerdrDirectory(current.cwd, target.cwd)) ||
        (managed && !sameHerdrAgent(managed.target, target))) throw identityChanged();
    if (current.sessionRef !== target.sessionRef) {
      if (target.sessionRef || !current.sessionRef || !managed?.mayAdopt || !managed.sessionId ||
          !matchingClaudeSession(record(raw).agent_session, managed.sessionId)) throw identityChanged();
      managed.target = current;
      managed.mayAdopt = false;
    }
    return current;
  }

  async sendPrompt(settings: HerdrSettings, target: HerdrWorkflowTarget, prompt: string, signal?: AbortSignal): Promise<HerdrWorkflowTarget> {
    const identity = key(settings, target.paneId);
    const managed = this.managed.get(identity);
    if (!managed?.fresh || !sameHerdrAgent(managed.target, target) ||
        !prompt.trim() || prompt.length > 10000 || /\p{Cc}/u.test(prompt.replace(/[\n\r\t]/gu, '')))
      throw new Error('Send one bounded workflow prompt only to its fresh dedicated Herdr agent.');
    const current = await this.inspectAgent(settings, target, signal);
    if (!herdrReady(current)) throw new Error('The dedicated Herdr agent is not idle and ready. Inspect it before continuing.');
    managed.fresh = false;
    const result = await this.result(settings, ['agent', 'prompt', target.paneId, prompt], 'agent_prompted', signal);
    return this.verifyIdentity(settings, current, result.agent);
  }

  dispose(): void { this.cancellation.abort(); }
}
