import { HerdrAdmission } from './herdr-admission';
import type { HerdrActions } from './herdr-ports';
import { HerdrTaskPromptError, herdrResultOutput, herdrSystemPrompt, herdrTaskPrompt } from './herdr-result';
import type { HerdrAttemptFiles, HerdrWorkflowActions, HerdrWorkflowGateway, HerdrWorkflowRecord, HerdrWorkflowState, HerdrWorkflowStorage } from './herdr-workflow-ports';
import type { StageInput, StageResult, Timers } from './ports';
import { recordOperation } from './population';
import type { StudioStore } from './studio-store';
import { herdrReady, sameHerdrAgent } from '../domain/herdr';
import { ideaFingerprint } from '../domain/integrity';
import { ideaProjectId } from '../domain/projects';
import { agentModelCheck } from '../domain/stage-agents';
import { workflowProposalRevision } from '../domain/configured-workflow-run';
import { executionAccess } from './workflow-execution';

const terminal = (record: HerdrWorkflowRecord) => ['completed', 'reviewed'].includes(record.phase);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const attention = () => new Error('The Herdr workflow needs attention. Inspect the original session and recovery record; no external action was retried or interrupted.');
interface Clock { id(): string; now(): number }

/** Application orchestration: external delivery, verified output and canonical advancement stay separate. */
export class HerdrWorkflowService implements HerdrWorkflowActions {
  private readonly state: HerdrWorkflowState = { records: [], ready: false, busy: false, error: '' };
  private readonly listeners = new Set<(state: HerdrWorkflowState) => void>();
  private closed = false;
  private recoveryBusy = false;
  private cancellation: AbortController | undefined;
  constructor(
    private readonly store: StudioStore,
    private readonly manual: HerdrActions,
    private readonly admission: HerdrAdmission,
    private readonly storage: HerdrWorkflowStorage,
    private readonly gateway: HerdrWorkflowGateway,
    private readonly files: HerdrAttemptFiles,
    private readonly timers: Timers,
    private readonly clock: Clock = { id: () => crypto.randomUUID(), now: () => Date.now() },
  ) {}
  snapshot(): HerdrWorkflowState { return structuredClone(this.state); }
  subscribe(listener: (state: HerdrWorkflowState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private publish(): void {
    if (!this.closed) for (const listener of this.listeners) {
      try { listener(this.snapshot()); } catch { /* Isolate observers. */ }
    }
  }
  private holds(): void { this.admission.replaceHolds('workflow', this.state.records.filter(record => !terminal(record)).map(record => record.id)); }
  private async event(code: Parameters<typeof recordOperation>[1], id: string): Promise<void> {
    await this.store.transaction(state => recordOperation(state, code, 'committed', undefined, 1, id));
  }
  async start(): Promise<void> {
    this.admission.close('workflow');
    this.state.ready = false;
    try {
      const loaded = await this.storage.load();
      const records = loaded.map(record => terminal(record) ? record : { ...record, phase: 'attention' as const, inspectedAt: undefined });
      if (records.some(record => !terminal(record))) await this.storage.save(records);
      if (this.closed) return;
      this.state.records = records;
      this.state.ready = true;
      this.state.error = '';
      this.admission.initialize('workflow', records.filter(record => !terminal(record)).map(record => record.id));
      this.publish();
    } catch {
      this.state.error = 'The private Herdr workflow journal could not be loaded. Restore it before changing Herdr.';
      this.publish();
      throw new Error(this.state.error);
    }
  }
  private assertReady(): void {
    if (this.closed || !this.state.ready) throw new Error('The Herdr workflow journal is closed or not ready. Restore it before continuing.');
  }
  private check(input: StageInput, deadline: number, record: HerdrWorkflowRecord): void {
    if (this.closed || input.signal?.aborted || this.clock.now() >= deadline) throw attention();
    const state = this.store.snapshot();
    const current = state.ideas.find(idea => idea.id === record.ideaId);
    const project = state.projects?.find(project => project.id === record.projectId);
    if (!current || (record.workflow ? workflowProposalRevision(current) : ideaFingerprint(current)) !== record.fingerprint || !project || project.unavailable) throw attention();
  }
  private async save(record: HerdrWorkflowRecord, phase: HerdrWorkflowRecord['phase'], patch: Partial<HerdrWorkflowRecord> = {}): Promise<void> {
    const next = { ...record, ...patch, phase, updatedAt: new Date(this.clock.now()).toISOString() };
    const records = this.state.records.some(item => item.id === next.id)
      ? this.state.records.map(item => item.id === next.id ? next : item) : [...this.state.records, next];
    const retained = new Set(records.filter(terminal).slice(-100).map(item => item.id));
    const bounded = records.filter(item => !terminal(item) || retained.has(item.id));
    if (bounded.length > 500) throw new Error('Review unresolved Herdr attempts before starting another workflow.');
    await this.storage.save(bounded);
    Object.assign(record, next);
    this.state.records = bounded;
    this.holds();
    this.publish();
  }
  private async failed(record: HerdrWorkflowRecord): Promise<void> {
    this.admission.hold('workflow', record.id);
    try { await this.save(record, 'attention', { inspectedAt: undefined }); }
    catch {
      record.phase = 'attention';
      this.state.records = [...this.state.records.filter(item => item.id !== record.id), { ...record }];
      this.state.ready = false;
      this.admission.close('workflow');
    }
    this.state.error = attention().message;
    this.publish();
    await this.event('herdr-action-uncertain', record.id).catch(() => undefined);
  }
  private async pause(signal: AbortSignal | undefined, ms: number): Promise<void> {
    if (signal?.aborted) return;
    await new Promise<void>(resolve => {
      const done = () => { this.timers.clearTimeout(handle); signal?.removeEventListener('abort', done); resolve(); };
      const handle = this.timers.setTimeout(done, ms);
      signal?.addEventListener('abort', done, { once: true });
    });
  }
  private async bounded<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw attention();
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(attention());
      signal.addEventListener('abort', abort, { once: true });
      void Promise.resolve().then(() => { if (signal.aborted) throw attention(); return work(); })
        .then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }
  async run(original: StageInput): Promise<StageResult> {
    this.assertReady();
    if (!original.jobId || !uuid.test(original.jobId) || original.settings.provider !== 'herdr' ||
        (original.settings.herdrAgent ?? 'claude') !== 'claude' || !Number.isInteger(original.settings.timeoutSeconds) || original.settings.timeoutSeconds < 15 || original.settings.timeoutSeconds > 1800)
      throw new Error('A captured Herdr job, supported agent and bounded deadline are required.');
    const controller = new AbortController();
    const input = { ...original, ...(original.workflow ? { workflow: structuredClone(original.workflow) } : {}), signal: controller.signal, jobId: original.jobId, idea: structuredClone(original.idea), settings: structuredClone(original.settings), integration: structuredClone(original.integration) };
    const model = agentModelCheck(input.workflow?.step.model ?? input.settings.model);
    const record: HerdrWorkflowRecord = {
      id: this.clock.id(), jobId: input.jobId, ideaId: input.idea.id, projectId: ideaProjectId(input.idea), stage: input.stage,
      model, kind: 'claude', settings: structuredClone(this.manual.snapshot().settings), fingerprint: input.workflow ? input.workflow.proposalRevision : ideaFingerprint(input.idea),
      ...(input.workflow ? { workflow: structuredClone(input.workflow) } : {}),
      nonce: this.clock.id(), at: new Date(this.clock.now()).toISOString(), phase: 'preparing',
      projectPath: input.integration.projectPath, worktreeFolder: input.integration.worktreeFolder,
    };
    const deadline = this.clock.now() + input.settings.timeoutSeconds * 1000;
    const release = this.admission.acquire();
    this.cancellation = controller;
    const abort = () => controller.abort();
    if (original.signal?.aborted) controller.abort();
    original.signal?.addEventListener('abort', abort, { once: true });
    const deadlineTimer = this.timers.setTimeout(abort, input.settings.timeoutSeconds * 1000);
    this.state.busy = true;
    this.state.error = '';
    this.publish();
    let area: Awaited<ReturnType<HerdrAttemptFiles['prepare']>> | undefined;
    let externalUncertain = false;
    let completed = false;
    try {
      this.check(input, deadline, record);
      await this.save(record, 'preparing');
      await this.event('herdr-action-requested', record.id);
      area = await this.bounded(controller.signal, () => this.files.prepare(input));
      if (area.workspaceId) { record.workspaceId = area.workspaceId; if (record.workflow) record.workflow.workspaceId = area.workspaceId; }
      const systemPrompt = herdrSystemPrompt(input, area.resultPath);
      const prompt = herdrTaskPrompt(input, record, area.resultPath);
      this.check(input, deadline, record);
      Object.assign(record, { cwd: area.cwd, resultPath: area.resultPath,
        configuration: { systemPrompt, timeoutSeconds: input.settings.timeoutSeconds, sessionId: input.jobId } });
      await this.save(record, 'creating-workspace');
      const prepared = area;
      const workspace = await this.bounded(controller.signal, () => this.gateway.createWorkspace(record.settings, prepared.cwd, `CoForge ${input.idea.id} ${record.id.slice(0, 8)}`, input.signal));
      Object.assign(record, workspace);
      await this.save(record, 'workspace-created');
      this.check(input, deadline, record);
      await this.save(record, 'starting-agent');
      externalUncertain = true;
      const started = await this.bounded(controller.signal, () => this.gateway.startAgent(record.settings, workspace.pane, {
        name: `cf-${record.id.replaceAll('-', '').slice(0, 24)}`, kind: 'claude', model, stage: input.stage,
        effort: input.workflow?.step.effort,
        resultPath: prepared.resultPath, systemPrompt, sessionId: input.jobId, ...(input.workflow ? { access: executionAccess(input) } : {}),
      }, input.signal));
      Object.assign(record, { target: started.agent, launchArgv: started.argv });
      await this.save(record, 'agent-ready');
      this.check(input, deadline, record);
      await this.save(record, 'sending-prompt');
      const sent = await this.bounded(controller.signal, () => this.gateway.sendPrompt(record.settings, started.agent, prompt, input.signal));
      record.target = sent;
      await this.save(record, 'waiting-result');
      let target = sent;
      let busy = sent.status === 'working';
      const baseline = started.agent.completionSeq;
      while (true) {
        this.check(input, deadline, record);
        const observed = await this.bounded(controller.signal, () => this.gateway.inspectAgent(record.settings, target, input.signal));
        if (observed.sessionRef !== target.sessionRef) { record.target = observed; await this.save(record, 'waiting-result'); }
        target = observed;
        this.check(input, deadline, record);
        busy ||= target.status === 'working';
        if (target.status === 'working') externalUncertain = true;
        if (target.status === 'blocked' || !target.ready) throw attention();
        const advanced = baseline !== undefined && target.completionSeq !== undefined && target.completionSeq > baseline;
        if (herdrReady(target) && (busy || advanced)) {
          externalUncertain = false;
          await this.bounded(controller.signal, () => prepared.captureChanges?.() ?? Promise.resolve(undefined));
          const raw = await this.bounded(controller.signal, () => prepared.readResult());
          if (raw !== null) {
            const output = herdrResultOutput(raw, record);
            const result = await this.bounded(controller.signal, () => prepared.finish(output));
            externalUncertain = true;
            const final = await this.bounded(controller.signal, () => this.gateway.inspectAgent(record.settings, target, input.signal));
            if (!herdrReady(final)) throw attention();
            externalUncertain = false;
            this.check(input, deadline, record);
            record.target = final;
            await this.save(record, 'completed');
            completed = true;
            await this.event('herdr-action-delivered', record.id).catch(() => {
              this.state.error = 'Herdr completed, but its operation log could not be updated. The verified workflow journal was preserved.';
              this.publish();
            });
            return { ...(result.markdown !== undefined ? { markdown: result.markdown } : {}), ...(result.summary !== undefined ? { summary: result.summary } : {}), ...(result.screening ? { screening: result.screening } : {}), ...(result.rice ? { rice: result.rice } : {}),
              ...(result.plan ? { plan: result.plan } : {}), ...(result.increment ? { increment: result.increment } : {}) };
          }
        }
        await this.pause(input.signal, Math.min(500, Math.max(1, deadline - this.clock.now())));
      }
    } catch (error) {
      await this.failed(record);
      if (error instanceof HerdrTaskPromptError) {
        this.state.error = `${error.message} ${attention().message}`;
        this.publish();
        throw new HerdrTaskPromptError(this.state.error);
      }
      throw attention();
    } finally {
      this.timers.clearTimeout(deadlineTimer);
      original.signal?.removeEventListener('abort', abort);
      if (this.cancellation === controller) this.cancellation = undefined;
      await area?.release?.(!completed && externalUncertain).catch(() => undefined);
      await area?.dispose().catch(() => undefined);
      this.state.busy = false;
      release();
      this.publish();
    }
  }
  private async recover(id: string, work: (record: HerdrWorkflowRecord) => Promise<void>): Promise<void> {
    this.assertReady();
    this.admission.assertRecovery();
    if (this.recoveryBusy) throw new Error('A Herdr recovery inspection is already in progress.');
    const record = this.state.records.find(item => item.id === id);
    if (!record || record.phase !== 'attention') throw new Error('Only an attention record can be inspected or acknowledged.');
    this.recoveryBusy = true;
    try { await work(record); } finally { this.recoveryBusy = false; }
  }
  inspect(id: string): Promise<void> {
    return this.recover(id, async record => {
      if (JSON.stringify(this.manual.snapshot().settings) !== JSON.stringify(record.settings)) throw new Error('Restore the original Herdr executable and session before inspecting this attempt.');
      await this.manual.refresh();
      const current = this.manual.snapshot();
      if (!current.observation?.running || !current.observation.compatible || !current.checkedAt || this.clock.now() - Date.parse(current.checkedAt) > 30000)
        throw new Error('Inspect a fresh compatible observation of the original Herdr session first.');
      const observed = record.target && current.observation.agents.find(agent => agent.paneId === record.target?.paneId);
      const inspection = !record.target ? 'session' : observed && sameHerdrAgent(observed, record.target) ? 'original-target' : 'target-changed';
      await this.save(record, 'attention', { inspectedAt: new Date(this.clock.now()).toISOString(), inspection });
    });
  }
  acknowledge(id: string): Promise<void> {
    return this.recover(id, async record => {
      if (!record.inspectedAt || this.clock.now() - Date.parse(record.inspectedAt) > 30000 || JSON.stringify(this.manual.snapshot().settings) !== JSON.stringify(record.settings))
        throw new Error('Inspect the original Herdr session before acknowledging this uncertain attempt.');
      if (record.workspaceId) {
        const current = this.manual.snapshot();
        const target = record.target && current.observation?.agents.find(agent => agent.paneId === record.target?.paneId);
        const reusable = !!current.checkedAt && this.clock.now() - Date.parse(current.checkedAt) <= 30000 && !!current.observation?.running && !!current.observation.compatible && !!target && !!record.target && sameHerdrAgent(target, record.target) && target.name === record.target.name && target.cwd === record.target.cwd && herdrReady(target);
        if (!this.files.acknowledgeWorkspace) throw new Error('Workspace recovery is unavailable. Preserve the original attempt until it is restored.');
        await this.files.acknowledgeWorkspace(record.workspaceId, record.workflow?.attemptId ?? record.jobId, reusable);
      }
      await this.save(record, 'reviewed');
      await this.event('herdr-action-reviewed', record.id);
    });
  }
  async dispose(): Promise<void> {
    this.closed = true;
    this.cancellation?.abort();
    this.admission.close('workflow');
    this.gateway.dispose();
    this.listeners.clear();
  }
}
