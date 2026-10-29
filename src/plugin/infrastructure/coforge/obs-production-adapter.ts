import type { ObsProductionPort } from '../../features/coforge/application/obs-production-port';
import type { ObsSnapshot } from '../../features/coforge/domain/obs';
import type { ObsSceneContext } from '../../features/coforge/domain/obs-scenes';
import type { ObsProductionAction, ObsProductionSnapshot, ObsSceneTransform, ObsSourceFilter } from '../../features/coforge/domain/obs-production';
import { IntegrationFailure } from '../../features/coforge/domain/integration-failure';
import { record } from '../../features/coforge/domain/check';
import { productionEffect, productionInput, productionScene, type ProductionEffect } from './obs-production-effects';
import { productionCapabilities, type ObsProductionRpc } from './obs-production-rpc';
import { boundedList, boundedText, readProduction } from './obs-production-read';
import { projectedProductionSettings } from './obs-production-settings';
import type { TwitchSecrets } from './twitch-auth';
import { setTimeout as delay } from 'node:timers/promises';

/** Scoped production RPC. Credentials stay in host storage; state contains only supported projections. */
export class ObsProductionAdapter implements ObsProductionPort {
  private readonly meters = new Map<string, { peakDb: number; observedAt: string }>();
  private epoch = -1;
  private lastRecording: string | null = null;
  private lastReplay: string | null = null;
  private destination: ObsProductionSnapshot['destination'];
  private outputPresetReloadRequired = false;
  private closed = false;
  constructor(
    private readonly rpc: ObsProductionRpc,
    private readonly snapshot: () => Promise<ObsSnapshot>,
    private readonly available: () => ReadonlySet<string>,
    private readonly current: () => ObsSceneContext,
    private readonly secrets: TwitchSecrets,
    private readonly inspectionBudgetMs = 15000,
  ) {}
  reset(): void {
    this.meters.clear(); this.lastRecording = null; this.lastReplay = null; this.destination = undefined; this.outputPresetReloadRequired = false;
  }
  dispose(): void { this.closed = true; this.reset(); }
  observe(type: string, data: Record<string, unknown>): void {
    if (type === 'InputRemoved') {
      const id = data.inputUuid ?? data.inputName;
      if (typeof id === 'string') this.meters.delete(id);
    }
    if (type === 'InputVolumeMeters' && Array.isArray(data.inputs) && data.inputs.length <= 128) {
      for (const [id, value] of this.meters) if (Date.now() - Date.parse(value.observedAt) > 5000) this.meters.delete(id);
      for (const value of data.inputs) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const input = record(value);
        const id = input.inputUuid ?? input.inputName;
        if (typeof id !== 'string' || id.length > 300 || !Array.isArray(input.inputLevelsMul) || input.inputLevelsMul.length > 8) continue;
        const peaks = input.inputLevelsMul.map(channel => Array.isArray(channel) ? channel[1] : null)
          .filter((peak): peak is number => typeof peak === 'number' && Number.isFinite(peak) && peak >= 0 && peak <= 100);
        if (!peaks.length) continue;
        const peak = Math.max(...peaks);
        this.meters.delete(id);
        if (this.meters.size >= 256) {
          const oldest = this.meters.keys().next().value;
          if (oldest !== undefined) this.meters.delete(oldest);
        }
        this.meters.set(id, { peakDb: peak > 0 ? Math.max(-100, 20 * Math.log10(peak)) : -100, observedAt: new Date().toISOString() });
      }
    }
    if (type === 'ReplayBufferSaved' && typeof data.savedReplayPath === 'string' && data.savedReplayPath.length <= 4096) this.lastReplay = data.savedReplayPath;
    if (type === 'RecordFileChanged' && typeof data.newOutputPath === 'string' && data.newOutputPath.length <= 4096) this.lastRecording = data.newOutputPath;
  }
  private assertContext(expected: ObsSceneContext, revision = true): void {
    const current = this.current();
    if (current.epoch !== expected.epoch || current.collection !== expected.collection || revision && current.revision !== expected.revision)
      throw new IntegrationFailure('validation', 'OBS changed since this action was reviewed. Refresh production state before continuing.');
  }
  async inspect(): Promise<ObsProductionSnapshot> {
    if (this.closed) throw new IntegrationFailure('service', 'The OBS production adapter is closed.');
    const deadline = Date.now() + this.inspectionBudgetMs;
    const broadcast = await this.snapshot();
    if (this.epoch !== broadcast.epoch) { this.reset(); this.epoch = broadcast.epoch; }
    const meters = new Map([...this.meters.entries()].filter(([, value]) => Date.now() - Date.parse(value.observedAt) <= 2000));
    const bounded: ObsProductionRpc = { request: async (type, data) => {
      const remaining = Math.min(8000, deadline - Date.now());
      if (remaining <= 0) throw new IntegrationFailure('service', 'OBS production inspection exceeded its time budget. Refresh before changing controls.');
      const cancel = new AbortController();
      try {
        return await Promise.race([
          this.rpc.request(type, data, remaining),
          delay(remaining, undefined, { signal: cancel.signal }).then(() => { throw new IntegrationFailure('service', 'OBS production inspection timed out.'); }),
        ]);
      } finally { cancel.abort(); }
    } };
    const state = await readProduction(bounded, this.available(), broadcast, meters);
    if (Date.now() >= deadline) throw new IntegrationFailure('service', 'OBS production inspection exceeded its time budget. No fresh snapshot was accepted.');
    this.assertContext(state.context);
    return { ...state, lastRecording: this.lastRecording, lastReplay: this.lastReplay, ...(this.destination ? { destination: this.destination } : {}),
      ...(state.outputPreset && this.outputPresetReloadRequired ? { outputPreset: { ...state.outputPreset, status: 'saved-reload-required' } } : {}) };
  }
  async execute(action: ObsProductionAction): Promise<ObsProductionSnapshot> {
    this.assertContext(action.expected);
    if (!productionCapabilities(this.available()).includes(action.kind))
      throw new IntegrationFailure('validation', 'The connected OBS does not support this production action.');
    const before = await this.inspect();
    this.assertContext(action.expected);
    if (before.broadcast.transitioning || before.broadcast.reconnecting)
      throw new IntegrationFailure('validation', 'Wait until OBS is stable before changing production controls.');
    let sent = false;
    const deadline = Date.now() + 45000;
    const guarded: ObsProductionRpc = { request: async (type, data) => {
      this.assertContext(action.expected, !sent || action.kind === 'output-preset');
      if (Date.now() > deadline) throw new IntegrationFailure(sent ? 'uncertain' : 'service', 'The production action reached its time limit. Refresh OBS before continuing.');
      if (!this.available().has(type)) throw new IntegrationFailure('validation', 'This OBS request is unavailable in the connected version.');
      if (!type.startsWith('Get')) sent = true;
      const result = await this.rpc.request(type, data);
      this.assertContext(action.expected, false);
      return result;
    } };
    try {
      const effect = await productionEffect(guarded, before, action, this.secrets);
      const after = await this.settle(effect, action, Math.min(deadline, Date.now() + 8000));
      this.assertContext(action.expected, false);
      if (effect.lastRecording) this.lastRecording = effect.lastRecording;
      if (effect.lastReplay) this.lastReplay = effect.lastReplay;
      if (effect.destination) this.destination = effect.destination;
      if (action.kind === 'output-preset') this.outputPresetReloadRequired = true;
      return { ...after, lastRecording: this.lastRecording, lastReplay: this.lastReplay, ...(this.destination ? { destination: this.destination } : {}),
        ...(after.outputPreset && this.outputPresetReloadRequired ? { outputPreset: { ...after.outputPreset, status: 'saved-reload-required' } } : {}) };
    } catch (error) {
      if (error instanceof IntegrationFailure && (!sent || error.kind === 'uncertain' || error.kind === 'delivery')) throw error;
      throw new IntegrationFailure(sent ? 'uncertain' : 'validation', sent ? 'The production action was sent but could not be confirmed. Refresh OBS; do not replay it automatically.' : 'The production action could not be validated. Refresh OBS.');
    }
  }
  private async settle(effect: ProductionEffect, action: ObsProductionAction, deadline: number): Promise<ObsProductionSnapshot> {
    do {
      this.assertContext(action.expected, false);
      if (this.closed) break;
      try {
        const after = await this.inspect();
        if (await effect.confirm(after)) return after;
      } catch (error) {
        if (error instanceof IntegrationFailure && error.kind === 'uncertain') throw error;
      }
      if (Date.now() >= deadline) break;
      await delay(100);
    } while (Date.now() < deadline);
    throw new IntegrationFailure('uncertain', 'OBS did not confirm the requested production state. Refresh and inspect it before another action.');
  }
  async frame(sceneId: string) {
    const before = await this.snapshot();
    const scene = before.scenes.find(value => value.id === sceneId);
    if (!scene || !this.available().has('GetSourceScreenshot')) throw new IntegrationFailure('validation', 'Select an available scene with screenshot support.');
    const value = await this.rpc.request('GetSourceScreenshot', { sourceName: scene.name, imageFormat: 'jpg', imageWidth: 960, imageHeight: 540, imageCompressionQuality: 70 });
    const dataUrl = value.imageData;
    if (typeof dataUrl !== 'string' || dataUrl.length > 900000 || !/^data:image\/(?:png|jpeg|jpg);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl))
      throw new IntegrationFailure('service', 'OBS returned an invalid or oversized screenshot.');
    this.assertContext({ epoch: before.epoch, collection: before.sceneCollectionVersion ?? 0, revision: before.sceneVersion ?? 0 });
    return { sceneId, dataUrl, observedAt: new Date().toISOString(), kind: 'screenshot' as const };
  }
  async properties(inputId: string, property: string) {
    const state = await this.inspect();
    const input = productionInput(state, inputId);
    if (!this.available().has('GetInputPropertiesListPropertyItems') || !/^[a-zA-Z0-9_]{1,80}$/.test(property))
      throw new IntegrationFailure('validation', 'This source property cannot be enumerated.');
    const value = await this.rpc.request('GetInputPropertiesListPropertyItems', { inputName: input.name, propertyName: property });
    this.assertContext(state.context);
    return boundedList(value.propertyItems, 512).map(value => {
      const item = record(value);
      if (typeof item.itemValue !== 'string' && (typeof item.itemValue !== 'number' || !Number.isFinite(item.itemValue)))
        throw new IntegrationFailure('service', 'OBS returned an unsupported device option.');
      if (typeof item.itemValue === 'string') boundedText(item.itemValue, 4096);
      return { label: boundedText(item.itemName), value: item.itemValue, enabled: item.itemEnabled === true };
    });
  }
  async transform(sceneId: string, itemId: number): Promise<ObsSceneTransform> {
    const state = await this.inspect();
    const scene = productionScene(state, sceneId);
    const value = record((await this.rpc.request('GetSceneItemTransform', { sceneName: scene.name, sceneItemId: itemId })).sceneItemTransform);
    this.assertContext(state.context);
    const number = (key: string) => {
      const result = value[key];
      if (typeof result !== 'number' || !Number.isFinite(result)) throw new IntegrationFailure('service', 'OBS returned incomplete source transform data.');
      return result;
    };
    return { positionX: number('positionX'), positionY: number('positionY'), scaleX: number('scaleX'), scaleY: number('scaleY'), rotation: number('rotation'), cropLeft: number('cropLeft'), cropRight: number('cropRight'), cropTop: number('cropTop'), cropBottom: number('cropBottom'), boundsType: boundedText(value.boundsType), boundsWidth: number('boundsWidth'), boundsHeight: number('boundsHeight'), alignment: number('alignment') };
  }
  async filters(inputId: string): Promise<ObsSourceFilter[]> {
    const state = await this.inspect();
    const input = productionInput(state, inputId);
    const value = await this.rpc.request('GetSourceFilterList', { sourceName: input.name });
    this.assertContext(state.context);
    return boundedList(value.filters).map(value => {
      const filter = record(value);
      const kind = boundedText(filter.filterKind);
      if (typeof filter.filterIndex !== 'number' || !Number.isInteger(filter.filterIndex) || typeof filter.filterEnabled !== 'boolean')
        throw new IntegrationFailure('service', 'OBS returned invalid filter data.');
      return { name: boundedText(filter.filterName), kind, index: filter.filterIndex, enabled: filter.filterEnabled, settings: projectedProductionSettings(kind, filter.filterSettings ?? {}, true) };
    });
  }
  async saveOutputSecret(secretName: string, value: string): Promise<void> {
    if (!/^coforge-obs-output-[a-zA-Z0-9_-]{1,80}$/.test(secretName) || !value || value.length > 4096 || value.includes('\0'))
      throw new IntegrationFailure('validation', 'Use an OBS output secret reference and a nonempty stream key, up to 4,096 characters.');
    try { this.secrets.setSecret(secretName, value); }
    catch { throw new IntegrationFailure('authorization', 'The stream key could not be saved in Obsidian secret storage.'); }
  }
}
