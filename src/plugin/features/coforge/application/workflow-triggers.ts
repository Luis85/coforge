import { automationContextCheck, type AutomationContext, type AutomationOrigin } from '../domain/automation-context';
import { AUTOMATION_MAX_DEPTH, emptyWorkflowTriggers, workflowTriggerDraftCheck, workflowTriggerStateCheck, type WorkflowTrigger, type WorkflowTriggerDraft, type WorkflowTriggerOccurrence, type WorkflowTriggerState } from '../domain/workflow-triggers';
import { record } from '../domain/check';
import { workflowTriggerSourcePath } from '../domain/workflow-triggers';
import type { WorkflowTriggerActions, WorkflowTriggerHost, WorkflowTriggerSnapshot, WorkflowTriggerStorage } from './workflow-trigger-ports';

function draft(binding: WorkflowTrigger): WorkflowTriggerDraft {
  return workflowTriggerDraftCheck({ name: binding.name, enabled: binding.enabled, event: binding.event, scope: binding.scope, projectId: binding.projectId,
    workflow: binding.workflow, workflowRevision: binding.workflowRevision, request: binding.request, ...(binding.ideaId ? { ideaId: binding.ideaId } : {}), cooldownSeconds: binding.cooldownSeconds });
}
/** Only committed facts enter this lane. Admission reservations survive reload; events are never backfilled. */
export class WorkflowTriggers implements WorkflowTriggerActions {
  private state = emptyWorkflowTriggers(); private ready = false; private error = ''; private disposed = false;
  private startedAt = 0; private tail: Promise<unknown> = Promise.resolve(); private stopSource = () => {};
  private listening = false;
  private readonly controller = new AbortController(); private readonly listeners = new Set<(state: WorkflowTriggerSnapshot) => void>();
  constructor(private readonly storage: WorkflowTriggerStorage, private readonly host: WorkflowTriggerHost, private readonly now = Date.now) {}
  snapshot(): WorkflowTriggerSnapshot { return { ...structuredClone(this.state), ready: this.ready && !this.disposed, error: this.error }; }
  subscribe(listener: (state: WorkflowTriggerSnapshot) => void): () => void { this.listeners.add(listener); listener(this.snapshot()); return () => { this.listeners.delete(listener); }; }
  private publish(): void { for (const listener of this.listeners) { try { listener(this.snapshot()); } catch { /* Observers never change committed effects. */ } } }
  private serial<T>(work: () => Promise<T>): Promise<T> { const next = this.tail.then(work); this.tail = next.catch(() => undefined); return next; }
  private assertReady(): void { if (!this.ready || this.disposed) throw new Error(this.error || 'Workflow triggers are unavailable. Refresh their private journal.'); }
  private async commit(state: WorkflowTriggerState): Promise<void> {
    state.revision++;
    try { await this.storage.save(workflowTriggerStateCheck(state)); this.state = structuredClone(state); this.error = ''; this.publish(); }
    catch { this.ready = false; this.error = 'Workflow-trigger storage failed. Restore its private journal and refresh; no automatic admission retry.'; this.publish(); throw new Error(this.error); }
  }
  private binding(id: string, revision?: number): WorkflowTrigger {
    const binding = this.state.bindings.find(item => item.id === id);
    if (!binding || revision !== undefined && binding.revision !== revision) throw new Error('This trigger changed. Refresh before editing.'); return structuredClone(binding);
  }
  private async load(): Promise<void> {
    this.ready = false; const state = workflowTriggerStateCheck(await this.storage.load());
    if (this.host.owned()) {
      await this.host.configure();
      for (const occurrence of state.occurrences.filter(item => item.status === 'reserved' || item.status === 'attention' && item.acknowledgedAt === undefined)) {
        if (occurrence.status === 'reserved') { occurrence.status = 'attention'; occurrence.reason = 'Admission was interrupted. Inspect the original source/run before enabling this binding again; nothing was replayed.'; }
        const binding = state.bindings.find(item => item.id === occurrence.bindingId); if (binding) binding.enabled = false;
      }
      await this.commit(state);
    } else this.state = state;
    this.startedAt = this.now(); this.ready = true; this.error = ''; this.publish();
  }
  start(): Promise<void> {
    return this.serial(async () => {
      if (this.disposed) return; await this.load(); if (this.disposed) return;
      this.listen();
    });
  }
  private listen(): void {
    if (this.listening || this.disposed) return;
    this.stopSource = this.host.subscribe(event => { void this.observe(event).catch(() => { this.error ||= 'Event automation needs attention. Inspect its private journal and refresh.'; this.publish(); }); });
    this.listening = true;
  }
  refresh(): Promise<void> { return this.serial(async () => { if (this.disposed) throw new Error('Workflow triggers are stopped.'); await this.load(); this.listen(); }); }
  async describe(projectId: string, workflow: 'v1' | 'v2') {
    const value = await this.host.describe({ name: 'Preflight', enabled: false, event: 'request-created', scope: 'project', projectId,
      workflow, workflowRevision: 'preflight', request: 'event', cooldownSeconds: 60 });
    const definition = record(JSON.parse(value.definitionJson));
    return { revision: value.revision, name: typeof definition.name === 'string' ? definition.name : 'Saved workflow', subject: value.subject };
  }
  save(input: unknown, id?: string, expectedRevision?: number, acknowledgeUnknown = false): Promise<void> {
    return this.serial(async () => {
      this.assertReady(); await this.host.configure(); const checked = workflowTriggerDraftCheck(input);
      const definition = await this.host.describe(checked);
      if (definition.revision !== checked.workflowRevision) throw new Error('The saved workflow changed. Review its current revision before enabling this trigger.');
      const previous = id ? this.binding(id, expectedRevision) : undefined;
      if (id && expectedRevision === undefined) throw new Error('Refresh the trigger before saving.');
      if (!id && this.state.bindings.length >= 100) throw new Error('The vault reached its 100-trigger limit.');
      const uncertain = this.state.occurrences.filter(item => item.bindingId === id && (item.status === 'reserved' || item.status === 'attention' && item.acknowledgedAt === undefined));
      if (checked.enabled && uncertain.length && !acknowledgeUnknown) throw new Error('Inspect the uncertain admission, then explicitly acknowledge recovery before enabling this trigger.');
      const state = structuredClone(this.state);
      const binding: WorkflowTrigger = { ...checked, id: previous?.id ?? crypto.randomUUID(), revision: (previous?.revision ?? 0) + 1, enabledAt: this.now(), ...(previous?.lastStartedAt !== undefined ? { lastStartedAt: previous.lastStartedAt } : {}) };
      state.bindings = [...state.bindings.filter(item => item.id !== binding.id), binding];
      if (acknowledgeUnknown) for (const item of state.occurrences.filter(item => uncertain.some(previous => previous.id === item.id))) { if (item.status === 'reserved') { item.status = 'attention'; item.reason = 'Interrupted admission inspected and explicitly acknowledged; the original event was not replayed.'; } item.acknowledgedAt = this.now(); }
      await this.commit(state);
    });
  }
  remove(id: string, expectedRevision: number): Promise<void> {
    return this.serial(async () => { this.assertReady(); await this.host.configure(); this.binding(id, expectedRevision);
      if (this.state.occurrences.some(item => item.bindingId === id && (item.status === 'reserved' || item.status === 'attention' && item.acknowledgedAt === undefined))) throw new Error('Inspect and acknowledge uncertain admissions before removing their binding.');
      const state = structuredClone(this.state); state.bindings = state.bindings.filter(item => item.id !== id); await this.commit(state); });
  }
  private append(state: WorkflowTriggerState, occurrence: WorkflowTriggerOccurrence): void {
    while (state.occurrences.length >= 200 || JSON.stringify(state).length + JSON.stringify(occurrence).length > 4000000) {
      const index = state.occurrences.findIndex(item => item.status === 'skipped' || item.status === 'attention' && item.acknowledgedAt !== undefined || item.status === 'submitted' && item.runId && !this.host.active(item.snapshot.workflow, item.runId));
      if (index < 0) throw new Error('Resolve active/uncertain trigger evidence before admitting more workflows.'); state.occurrences.splice(index, 1);
    }
    state.occurrences.push(occurrence);
  }
  observe(raw: AutomationContext): Promise<void> {
    const event = automationContextCheck(raw);
    const bindings = this.state.bindings.filter(binding => binding.enabled && binding.event === event.type && (binding.scope === 'application' || binding.projectId === event.projectId)).map(binding => structuredClone(binding));
    return this.serial(async () => {
      if (!bindings.length || this.disposed || !this.ready || !this.host.owned() || this.state.seen.includes(event.id)) return;
      await this.host.configure();
      const seen = structuredClone(this.state); seen.seen = [...seen.seen, event.id].slice(-1000); await this.commit(seen);
      for (const snapshot of bindings) {
        if (this.disposed) return;
        const current = this.state.bindings.find(item => item.id === snapshot.id);
        if (!current?.enabled || current.revision !== snapshot.revision) continue;
        const state = structuredClone(this.state); const binding = state.bindings.find(item => item.id === snapshot.id)!;
        const occurrence: WorkflowTriggerOccurrence = { id: crypto.randomUUID(), bindingId: binding.id, bindingRevision: binding.revision,
          event: structuredClone(event), snapshot: draft(binding), status: 'skipped', reason: '', at: this.now() };
        const readiness = this.host.readiness(binding.projectId, binding.workflow);
        let reason = Date.parse(event.at) < Math.max(this.startedAt, binding.enabledAt) ? 'Event predates activation; missed events are not replayed.' : '';
        if (!reason && !readiness.ready) reason = readiness.reason;
        if (!reason && this.state.occurrences.some(item => item.bindingId === binding.id && (item.status === 'reserved' || item.status === 'attention' && item.acknowledgedAt === undefined))) { reason = 'Inspect and acknowledge the unresolved admission before enabling future events.'; binding.enabled = false; }
        if (!reason && event.origin?.bindingIds.includes(binding.id)) reason = 'This event chain already used the binding; loop prevented.';
        if (!reason && (event.origin?.bindingIds.length ?? 0) >= AUTOMATION_MAX_DEPTH) reason = 'The event chain reached its host-controlled depth limit.';
        if (!reason && binding.lastStartedAt !== undefined && this.now() - binding.lastStartedAt < binding.cooldownSeconds * 1000) reason = 'Binding cooldown is active; event skipped.';
        if (!reason && this.state.occurrences.some(item => item.bindingId === binding.id && item.runId && this.host.active(binding.workflow, item.runId))) reason = 'This binding’s previous workflow is still active; overlap skipped.';
        let definition: Awaited<ReturnType<WorkflowTriggerHost['describe']>> | undefined;
        if (!reason) {
          try { definition = await this.host.describe(draft(binding)); }
          catch { reason = 'The saved workflow or selected request is unavailable. Repair the binding before enabling it again.'; binding.enabled = false; }
          if (definition && definition.revision !== binding.workflowRevision) { reason = 'Workflow revision changed; review and enable the binding again.'; binding.enabled = false; }
          if (definition?.subject === 'idea' && binding.request === 'event' && (!event.ideaId || event.projectId !== binding.projectId)) reason = 'This workflow needs an existing request from the same project. The event did not provide one.';
        }
        if (reason) { occurrence.reason = reason; this.append(state, occurrence); await this.commit(state); continue; }
        occurrence.status = 'reserved'; occurrence.reason = 'Workflow admission reserved.'; occurrence.definitionJson = definition?.definitionJson;
        if (definition?.subject === 'note') occurrence.sourcePath = workflowTriggerSourcePath(occurrence.id);
        this.append(state, occurrence); binding.lastStartedAt = this.now(); await this.commit(state);
        const origin: AutomationOrigin = { rootEventId: event.origin?.rootEventId ?? event.id, bindingIds: [...(event.origin?.bindingIds ?? []), binding.id] };
        let receipt: { runId: string; sourcePath?: string };
        try { this.controller.signal.throwIfAborted(); receipt = await this.host.dispatch(draft(binding), occurrence, origin, this.controller.signal); }
        catch {
          const failed = structuredClone(this.state); const item = failed.occurrences.find(item => item.id === occurrence.id)!;
          item.status = 'attention'; item.reason = 'Admission could not be confirmed. Inspect the original source and workflow, acknowledge recovery, and explicitly enable future events; no automatic retry.';
          failed.bindings.find(item => item.id === binding.id)!.enabled = false; await this.commit(failed); continue;
        }
        const confirmed = structuredClone(this.state); Object.assign(confirmed.occurrences.find(item => item.id === occurrence.id)!, receipt, { status: 'submitted', reason: 'Workflow submitted. Inspect its run for progress and results.' }); await this.commit(confirmed);
      }
    });
  }
  async dispose(): Promise<void> { this.disposed = true; this.controller.abort(); this.stopSource(); await this.tail; this.listeners.clear(); }
}
