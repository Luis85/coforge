import type { StudioStore } from './studio-store';
import type { ObsShowActions, ObsShowExecutor } from './obs-show-ports';
import { emptyObsShow, OBS_SHOW_EVENTS, type ObsShowState, type ObsShowRun } from '../domain/obs-show';
import { obsShowPlanCheck } from '../domain/obs-show-check';
import { boolean, text } from '../domain/check';
import { IntegrationFailure } from '../domain/integration-failure';
import { recordOperation } from './population';
import type { InternalState } from './ports';

const show = (state: InternalState) => state.obsShow ??= emptyObsShow();
/** Finite, captured production sequences. Restart pauses triggers and never repeats an uncertain action. */
export class ObsShowWorkflow implements ObsShowActions {
  private closed = true;
  private running = false;
  private stopEvents = () => {};
  private handling = false;
  private lifecycle = 0;
  constructor(private readonly store: StudioStore, private readonly executor: ObsShowExecutor) {}
  async start(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    this.closed = true;
    this.stopEvents();
    await this.store.transaction(state => {
      const value = show(state);
      value.automationEnabled = false;
      if (value.run?.status === 'running') {
        value.run.status = 'uncertain';
        value.run.error = 'CoForge closed before this cue finished. Inspect OBS and acknowledge the partial cue; it will not replay.';
        for (const step of value.run.steps) if (step.status === 'pending') step.status = 'uncertain';
      }
    });
    if (lifecycle !== this.lifecycle) return;
    this.closed = false;
    this.stopEvents = this.store.subscribeEvents(event => this.handleEvent(event.type, event.record.sequence));
  }
  dispose(): void { this.lifecycle++; this.closed = true; this.stopEvents(); }
  snapshot(): ObsShowState { return this.store.snapshot().obsShow ?? emptyObsShow(); }
  private open(): void { if (this.closed) throw new IntegrationFailure('validation', 'Reopen CoForge before operating show cues.'); }
  async savePlan(input: unknown): Promise<ObsShowState> {
    this.open();
    const plan = obsShowPlanCheck(input);
    await this.store.transaction(state => {
      const value = show(state);
      const replacement = [...value.plans.filter(item => item.id !== plan.id), plan];
      if (OBS_SHOW_EVENTS.some(event => replacement.flatMap(item => item.bindings).filter(binding => binding.enabled && binding.event === event).length > 10))
        throw new IntegrationFailure('validation', 'An event may trigger at most ten enabled cues across all show plans.');
      const index = value.plans.findIndex(item => item.id === plan.id);
      if (index < 0) {
        if (value.plans.length >= 100) throw new IntegrationFailure('validation', 'Remove a show plan before creating another.');
        value.plans.push(plan);
      } else value.plans[index] = plan;
      recordOperation(state, 'obs-show-plan-saved', 'committed', undefined, 1, plan.id);
    });
    return this.snapshot();
  }
  async deletePlan(id: string): Promise<void> {
    this.open();
    await this.store.transaction(state => {
      const value = show(state);
      if (value.run?.planId === id && ['running', 'uncertain', 'failed'].includes(value.run.status))
        throw new IntegrationFailure('validation', 'Acknowledge the active or partial cue before removing its plan.');
      value.plans = value.plans.filter(item => item.id !== id);
      recordOperation(state, 'obs-show-plan-deleted', 'committed', undefined, 1, id);
    });
  }
  runCue(planId: string, cueId: string): Promise<ObsShowState> { return this.executeCue(planId, cueId); }
  private async executeCue(planId: string, cueId: string, eventSequence?: number): Promise<ObsShowState> {
    this.open();
    if (this.running) throw new IntegrationFailure('validation', 'A production cue is already running.');
    this.running = true;
    let id: string | undefined;
    try {
      const current = this.snapshot();
      if (current.run && ['running', 'uncertain', 'failed'].includes(current.run.status))
        throw new IntegrationFailure('uncertain', 'Inspect OBS and acknowledge the previous partial cue before another cue.');
      const plan = current.plans.find(item => item.id === planId);
      const cue = plan?.segments.find(item => item.id === cueId);
      if (!plan || !cue) throw new IntegrationFailure('validation', 'Choose an existing show plan and cue.');
      id = crypto.randomUUID();
      const run: ObsShowRun = { id, planId, cueId, name: cue.name, durationSeconds: cue.durationSeconds, startedAt: new Date().toISOString(), status: 'running',
        steps: cue.steps.map(action => ({ action: structuredClone(action), status: 'skipped' })), ...(eventSequence ? { eventSequence } : {}) };
      await this.store.transaction(state => {
        const value = show(state);
        if (value.run) value.history = [...value.history, value.run].slice(-100);
        value.run = run;
        recordOperation(state, 'obs-show-cue-requested', 'none', undefined, 1, id);
      });
      for (let index = 0; index < run.steps.length; index++) await this.executeStep(run, index);
      await this.store.transaction(state => {
        const value = show(state);
        if (!value.run || value.run.id !== run.id) throw new IntegrationFailure('uncertain', 'The captured show cue changed. Inspect OBS.');
        value.run.status = 'confirmed';
        value.run.finishedAt = new Date().toISOString();
        recordOperation(state, 'obs-show-cue-confirmed', 'committed', undefined, 1, id);
      });
      return this.snapshot();
    } catch (error) {
      if (id && this.snapshot().run?.id === id && this.snapshot().run?.status === 'running') await this.failCue(id, error);
      throw error;
    } finally { this.running = false; }
  }
  private async executeStep(run: ObsShowRun, index: number): Promise<void> {
    this.open();
    const entry = run.steps[index];
    if (!entry) return;
    await this.store.transaction(state => {
      const value = show(state);
      if (value.run?.id !== run.id) throw new IntegrationFailure('uncertain', 'The captured cue changed.');
      value.run.steps[index]!.status = 'pending';
    });
    try {
      if (entry.action.kind === 'marker') await this.marker(entry.action.label, run.id);
      else await this.executor.execute(structuredClone(entry.action));
      this.open();
      await this.store.transaction(state => {
        const value = show(state);
        if (value.run?.id !== run.id) throw new IntegrationFailure('uncertain', 'The captured cue changed.');
        value.run.steps[index]!.status = 'confirmed';
        recordOperation(state, 'obs-show-step-confirmed', 'committed', undefined, 1, run.id);
      });
    } catch (error) {
      const uncertain = !(error instanceof IntegrationFailure) || error.kind === 'uncertain';
      try {
        await this.store.transaction(state => {
          const value = show(state);
          if (value.run?.id === run.id) value.run.steps[index]!.status = uncertain ? 'uncertain' : 'failed';
        });
      } catch { /* The pending journal is retained; recovery never repeats the action. */ }
      throw new IntegrationFailure(uncertain ? 'uncertain' : 'validation', uncertain ? 'A cue action is unconfirmed. Inspect OBS before acknowledging the partial cue.' : 'A cue action failed. Inspect the completed steps before acknowledging the partial cue.');
    }
  }
  private async failCue(id: string, error: unknown): Promise<void> {
    const uncertain = !(error instanceof IntegrationFailure) || error.kind === 'uncertain';
    try {
      await this.store.transaction(state => {
        const value = show(state);
        if (value.run?.id !== id) return;
        value.run.status = uncertain ? 'uncertain' : 'failed';
        value.run.finishedAt = new Date().toISOString();
        value.run.error = uncertain ? 'A production result is unconfirmed. Inspect OBS; no action will replay.' : 'The cue stopped after an action failed. Completed actions remain applied.';
        recordOperation(state, uncertain ? 'obs-show-cue-uncertain' : 'obs-show-cue-failed', uncertain ? 'uncertain' : 'none', undefined, 1, id);
      });
    } catch { /* The captured run/pending step remains authoritative. */ }
  }
  async recover(): Promise<ObsShowState> {
    this.open();
    if (this.running) throw new IntegrationFailure('validation', 'Wait for the current cue to settle.');
    await this.store.transaction(state => {
      const value = show(state);
      if (value.run && ['running', 'uncertain', 'failed'].includes(value.run.status)) {
        value.run.status = 'acknowledged';
        recordOperation(state, 'obs-show-recovered', 'none', undefined, 1, value.run.id);
      }
    });
    return this.snapshot();
  }
  async setAutomation(enabled: boolean): Promise<ObsShowState> {
    this.open();
    const next = boolean(enabled);
    await this.store.transaction(state => { show(state).automationEnabled = next; recordOperation(state, 'obs-show-automation-changed'); });
    return this.snapshot();
  }
  async addMarker(label: string): Promise<ObsShowState> { this.open(); await this.marker(label); return this.snapshot(); }
  private async marker(label: string, runId?: string): Promise<void> {
    const value = text({ trim: true, min: 1, max: 150 })(label);
    await this.store.transaction(state => {
      const current = show(state);
      current.markers = [...current.markers, { id: crypto.randomUUID(), label: value, at: new Date().toISOString(), ...(runId ? { runId } : {}) }].slice(-200);
      recordOperation(state, 'obs-show-marker-added');
    });
  }
  async handleEvent(event: string, sequence: number): Promise<void> {
    const type = OBS_SHOW_EVENTS.find(item => item === event);
    if (this.closed || !type || !Number.isSafeInteger(sequence) || sequence < 1) return;
    if (this.handling) {
      if (sequence > this.snapshot().lastEventSequence) await this.trigger(type, sequence, 'busy');
      return;
    }
    this.handling = true;
    try {
      const before = this.snapshot();
      if (sequence <= before.lastEventSequence) return;
      await this.store.transaction(state => { show(state).lastEventSequence = Math.max(show(state).lastEventSequence, sequence); });
      if (['stream-started', 'stream-paused', 'stream-resumed', 'stream-stopped'].includes(type)) await this.executor.settle?.();
      if (this.closed) return;
      if (this.snapshot().lastEventSequence > sequence) { await this.trigger(type, sequence, 'busy'); return; }
      const current = this.snapshot();
      const target = current.plans.flatMap(plan => plan.bindings.filter(binding => binding.enabled && binding.event === event).map(binding => ({ planId: plan.id, cueId: binding.cueId })));
      const ready = () => type === 'stream-stopped' ? Boolean(this.executor.ready?.()) : this.executor.live();
      const skip = target.length === 0 ? 'no-binding' : !current.automationEnabled ? 'paused' : !ready() ? 'offline' : this.running ? 'busy' : current.run && ['running', 'uncertain', 'failed'].includes(current.run.status) ? 'partial' : undefined;
      if (skip) { await this.trigger(type, sequence, skip); return; }
      for (const binding of target) {
        if (this.closed || !this.snapshot().automationEnabled || !ready()) { await this.trigger(type, sequence, 'paused'); return; }
        try { await this.executeCue(binding.planId, binding.cueId, sequence); }
        catch { await this.trigger(type, sequence, 'failed'); return; }
      }
      await this.trigger(type, sequence, 'completed');
    } finally { this.handling = false; }
  }
  private async trigger(event: typeof OBS_SHOW_EVENTS[number], sequence: number, reason: NonNullable<ObsShowState['lastTrigger']>['reason']): Promise<void> {
    await this.store.transaction(state => {
      const value = show(state);
      value.lastEventSequence = Math.max(value.lastEventSequence, sequence);
      if (sequence >= (value.lastTrigger?.sequence ?? 0)) value.lastTrigger = { event, sequence, reason };
      if (reason !== 'completed' && reason !== 'no-binding') recordOperation(state, 'obs-show-event-skipped', 'none');
    });
  }
}
