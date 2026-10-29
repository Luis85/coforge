import type { StudioStore } from './studio-store';
import type { ObsProductionPort } from './obs-production-port';
import type { ObsSceneGate } from './obs-scene-workflow';
import type { ObsProductionSnapshot, ObsProductionFrame, ObsPropertyOption, ObsSceneTransform, ObsSourceFilter } from '../domain/obs-production';
import { obsProductionActionCheck } from '../domain/obs-production-check';
import { text, number } from '../domain/check';
import { IntegrationFailure } from '../domain/integration-failure';
import { recordOperation } from './population';
import { emptyObsShow } from '../domain/obs-show';

export interface ObsProductionActions {
  inspect(): Promise<ObsProductionSnapshot>;
  execute(input: unknown): Promise<ObsProductionSnapshot>;
  frame(sceneId: string): Promise<ObsProductionFrame>;
  properties(inputId: string, property: string): Promise<ObsPropertyOption[]>;
  transform(sceneId: string, itemId: number): Promise<ObsSceneTransform>;
  filters(inputId: string): Promise<ObsSourceFilter[]>;
  saveOutputSecret(secretName: string, value: string): Promise<void>;
  acknowledgeOutputRestart(): Promise<ObsProductionSnapshot>;
}
/** All production mutations share stream admission, durable intent and uncertain-outcome recovery. */
export class ObsProductionWorkflow implements ObsProductionActions {
  constructor(private readonly store: StudioStore, private readonly port: ObsProductionPort, private readonly gate: ObsSceneGate) {}
  async inspect(): Promise<ObsProductionSnapshot> {
    await this.gate.fresh();
    const value = this.project(await this.port.inspect());
    await this.store.updateRuntime({ obsProduction: value });
    return value;
  }
  async execute(input: unknown): Promise<ObsProductionSnapshot> {
    await this.gate.claim();
    const id = crypto.randomUUID();
    let recorded = false;
    let started = false;
    let outputPreset = false;
    try {
      if (this.gate.uncertain()) throw new IntegrationFailure('uncertain', 'Refresh OBS and inspect the previous unconfirmed action before another change.');
      const action = obsProductionActionCheck(input);
      outputPreset = action.kind === 'output-preset';
      const before = await this.port.inspect();
      if (Object.keys(action.expected).some(key => Reflect.get(action.expected, key) !== Reflect.get(before.context, key)))
        throw new IntegrationFailure('validation', 'OBS changed. Refresh production controls before applying this action.');
      if (before.broadcast.transitioning || before.broadcast.reconnecting) throw new IntegrationFailure('validation', 'Wait for OBS to finish changing state.');
      if (!before.available.includes(action.kind)) throw new IntegrationFailure('validation', 'This OBS connection does not support the selected production action.');
      await this.store.transaction(state => {
        state.obsCommand = { id, kind: 'production', at: new Date().toISOString(), status: 'pending' };
        if (outputPreset) (state.obsShow ??= emptyObsShow()).outputRestartRequired = true;
        recordOperation(state, 'obs-production-requested', 'none', undefined, 1, id);
      });
      recorded = true;
      await this.gate.invalidate();
      started = true;
      const value = await this.port.execute(action);
      await this.gate.accept(value.broadcast);
      await this.store.transaction(state => {
        if (state.obsCommand?.id === id) state.obsCommand.status = 'confirmed';
        if (outputPreset) (state.obsShow ??= emptyObsShow()).outputRestartRequired = true;
        const path = action.kind === 'record-stop' ? value.lastRecording : action.kind === 'replay-save' ? value.lastReplay : null;
        if (path) {
          const show = state.obsShow ??= emptyObsShow();
          const file = { id, at: new Date().toISOString(), kind: action.kind === 'record-stop' ? 'recording' as const : 'replay' as const,
            path: text({ min: 1, max: 4096 })(path), obsEpoch: value.broadcast.epoch, timecode: value.broadcast.timecode,
            broadcastActive: value.broadcast.active, ...(value.broadcast.programSceneId ? { sceneId: value.broadcast.programSceneId } : {}) };
          show.outputFiles = [...(show.outputFiles ?? []).filter(item => item.id !== id), file].slice(-200);
        }
        recordOperation(state, 'obs-production-confirmed', 'committed', undefined, 1, id);
      });
      const projected = this.project(value);
      await this.store.updateRuntime({ obsProduction: projected });
      return projected;
    } catch (error) {
      const uncertain = error instanceof IntegrationFailure ? error.kind === 'uncertain' : started;
      const message = error instanceof IntegrationFailure ? error.message : started
        ? 'OBS did not confirm this action. Refresh and inspect its current state before another change.'
        : 'The production action was invalid or could not be saved. No OBS mutation was requested.';
      this.gate.failed(message, uncertain);
      try {
        await this.store.transaction(state => {
          if (recorded && state.obsCommand?.id === id) state.obsCommand.status = uncertain ? 'uncertain' : 'failed';
          if (outputPreset && started) (state.obsShow ??= emptyObsShow()).outputRestartRequired = true;
          recordOperation(state, uncertain ? 'obs-production-uncertain' : 'obs-production-failed', uncertain ? 'uncertain' : 'none', undefined, 1, id);
        });
      } catch { /* The durable pending intent blocks replay after restart. */ }
      throw new IntegrationFailure(uncertain ? 'uncertain' : 'validation', message);
    } finally { await this.gate.release(); }
  }
  async frame(sceneId: string): Promise<ObsProductionFrame> { await this.gate.fresh(); return this.port.frame(text({ min: 1, max: 300 })(sceneId)); }
  async properties(inputId: string, property: string): Promise<ObsPropertyOption[]> {
    await this.gate.fresh();
    return this.port.properties(text({ min: 1, max: 300 })(inputId), text({ min: 1, max: 100 })(property));
  }
  async transform(sceneId: string, itemId: number): Promise<ObsSceneTransform> {
    await this.gate.fresh();
    return this.port.transform(text({ min: 1, max: 300 })(sceneId), number({ integer: true, min: 0 })(itemId));
  }
  async filters(inputId: string): Promise<ObsSourceFilter[]> { await this.gate.fresh(); return this.port.filters(text({ min: 1, max: 300 })(inputId)); }
  async saveOutputSecret(secretName: string, value: string): Promise<void> {
    await this.gate.claim();
    try {
      const name = text({ pattern: /^coforge-obs-output-[a-zA-Z0-9_-]{1,80}$/ })(secretName);
      const secret = text({ min: 1, max: 1000 })(value);
      await this.port.saveOutputSecret(name, secret);
      await this.store.transaction(state => { recordOperation(state, 'obs-output-secret-saved'); });
    } finally { await this.gate.release(); }
  }
  private project(value: ObsProductionSnapshot): ObsProductionSnapshot {
    const required = this.store.snapshot().obsShow?.outputRestartRequired;
    return required !== undefined && value.outputPreset
      ? { ...value, outputPreset: { ...value.outputPreset, status: required ? 'saved-reload-required' : 'observed' } } : value;
  }
  /** An explicit operator declaration after a restart/rehearsal, never inferred from reconnect alone. */
  async acknowledgeOutputRestart(): Promise<ObsProductionSnapshot> {
    await this.gate.claim();
    try {
      if (this.gate.uncertain()) throw new IntegrationFailure('uncertain', 'Refresh OBS and inspect the unconfirmed action before reviewing output setup.');
      await this.gate.fresh();
      const value = await this.port.inspect();
      if (value.broadcast.active || value.broadcast.reconnecting || value.broadcast.transitioning || value.outputActivity !== false
        || value.recording?.active || value.replayBuffer?.active || value.virtualCamera?.active)
        throw new IntegrationFailure('validation', 'Observe OBS fully off air with recording, replay buffer and virtual camera stopped before confirming your restart and output review.');
      await this.store.transaction(state => {
        (state.obsShow ??= emptyObsShow()).outputRestartRequired = false;
        recordOperation(state, 'obs-output-restart-reviewed');
      });
      const projected = { ...value, ...(value.outputPreset ? { outputPreset: { ...value.outputPreset, status: 'observed' as const } } : {}) };
      await this.store.updateRuntime({ obsProduction: projected });
      return projected;
    } finally { await this.gate.release(); }
  }
}
