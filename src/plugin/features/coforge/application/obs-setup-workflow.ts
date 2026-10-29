import type { StudioStore } from './studio-store';
import type { ObsProductionActions } from './obs-production-workflow';
import type { ObsSceneActions } from '../domain/obs-scenes';
import type { ObsActions } from '../domain/obs';
import { OBS_SETUP_NAMES, OBS_SETUP_ROLES, type ObsSetupPreview, type ObsSetupResult, type ObsSetupState, type ObsSetupSource } from '../domain/obs-setup';
import { obsSetupInputCheck } from '../domain/obs-setup-check';
import { boolean, shape, text } from '../domain/check';
import { IntegrationFailure } from '../domain/integration-failure';
import { recordOperation } from './population';
export interface ObsSetupActions {
  snapshot(): ObsSetupState | undefined;
  preview(input: unknown): Promise<ObsSetupPreview>;
  apply(input: unknown): Promise<ObsSetupResult>;
  recover(): Promise<ObsSetupState | undefined>;
}
export class ObsSetupWorkflow implements ObsSetupActions {
  private current?: ObsSetupPreview;
  private busy = false;
  private closed = true;
  private lifecycle = 0;
  constructor(private readonly store: StudioStore, private readonly production: ObsProductionActions, private readonly scenes: ObsSceneActions, private readonly obs: Pick<ObsActions, 'configure'>) {}
  async start(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    this.closed = true;
    this.current = undefined;
    await this.store.transaction(state => {
      if (state.obsSetup?.status === 'running') {
        state.obsSetup.status = 'uncertain';
        state.obsSetup.lastError = 'CoForge closed during setup. Inspect the completed and pending steps before acknowledging; nothing will replay.';
      }
    });
    if (lifecycle === this.lifecycle) this.closed = false;
  }
  dispose(): void { this.lifecycle++; this.closed = true; this.current = undefined; }
  private open(): void { if (this.closed) throw new IntegrationFailure('validation', 'Reopen CoForge before preparing the OBS studio.'); }
  snapshot() { return this.store.snapshot().obsSetup; }
  async preview(input: unknown): Promise<ObsSetupPreview> {
    this.open();
    if (this.busy) throw new IntegrationFailure('validation', 'Studio setup is already running.');
    const draft = obsSetupInputCheck(input);
    const snapshot = await this.offline();
    if (new Set(draft.sources.map(item => item.name.toLocaleLowerCase())).size !== draft.sources.length)
      throw new IntegrationFailure('validation', 'Give every source a unique name.');
    const reuses = new Map<string, string>();
    for (const source of draft.sources) {
      if (!snapshot.inputKinds.includes(source.inputKind)) throw new IntegrationFailure('validation', 'A selected source type is unavailable in this OBS installation.');
      if (new Set(source.roles).size !== source.roles.length) throw new IntegrationFailure('validation', 'Choose each source role only once.');
      const existing = snapshot.inputs.find(item => item.name.toLocaleLowerCase() === source.name.toLocaleLowerCase());
      if (existing) {
        if (existing.name !== source.name || existing.kind !== source.inputKind || Object.entries(source.settings).some(([key, value]) => existing.settings[key] !== value))
          throw new IntegrationFailure('validation', 'A source name is already used with different settings. Choose another name or inspect the existing source.');
        reuses.set(source.name, existing.id);
      }
    }
    const scenes = OBS_SETUP_ROLES.map(role => {
      const name = draft.prefix ? `${draft.prefix} · ${OBS_SETUP_NAMES[role]}` : OBS_SETUP_NAMES[role];
      const existing = snapshot.broadcast.scenes.find(scene => scene.name === name);
      return { role, name, ...(existing ? { existingId: existing.id } : {}) };
    });
    const steps = [
      ...scenes.map(scene => `${scene.existingId ? 'Reuse' : 'Create'} scene: ${scene.name}`),
      ...draft.sources.flatMap(source => source.roles.map((role, index) => `${index === 0 && !reuses.has(source.name) ? 'Create' : 'Reuse'} source ${source.name}: ${OBS_SETUP_NAMES[role]}`)),
      ...(draft.video ? ['Apply video settings'] : []), ...(draft.recordDirectory ? ['Set recording directory'] : []),
      ...(draft.outputPreset ? ['Save output preset (restart OBS before rehearsal)'] : []),
      ...(draft.service ? ['Apply broadcast destination (requires rehearsal verification)'] : []), 'Assign development and BRB scenes',
      'Select Development scene for rehearsal (off air)',
    ];
    this.current = { id: crypto.randomUUID(), context: snapshot.context, input: draft, scenes, steps, sourceReuse: Object.fromEntries(reuses) };
    return structuredClone(this.current);
  }
  async apply(input: unknown): Promise<ObsSetupResult> {
    this.open();
    if (this.busy) throw new IntegrationFailure('validation', 'Studio setup is already running.');
    this.busy = true;
    let recorded = false;
    try {
      const confirmation = shape({ previewId: text({ min: 1, max: 100 }), confirmed: boolean }, { strict: true })(input);
      const preview = this.current;
      if (!confirmation.confirmed || !preview || preview.id !== confirmation.previewId)
        throw new IntegrationFailure('validation', 'Review the current setup preview and explicitly confirm it.');
      const previous = this.snapshot();
      if (previous && ['running', 'failed', 'uncertain'].includes(previous.status)) throw new IntegrationFailure('uncertain', 'Inspect and acknowledge the previous setup before preparing a new one.');
      const before = await this.offline();
      if (Object.keys(preview.context).some(key => Reflect.get(preview.context, key) !== Reflect.get(before.context, key)))
        throw new IntegrationFailure('validation', 'OBS changed since the preview. Review a new setup preview.');
      await this.store.transaction(state => {
        state.obsSetup = { id: preview.id, startedAt: new Date().toISOString(), status: 'running', completed: [], total: preview.steps.length, scenes: {} };
        recordOperation(state, 'obs-setup-requested', 'none', undefined, 1, preview.id);
      });
      recorded = true;
      for (const scene of preview.scenes) await this.step(`scene:${scene.role}`, async () => {
        let value = await this.offline();
        if (!value.broadcast.scenes.some(item => item.name === scene.name)) {
          await this.scenes.execute({ kind: 'scene-create', name: scene.name, expected: value.context });
          value = await this.production.inspect();
        }
        const found = value.broadcast.scenes.find(item => item.name === scene.name);
        if (!found) throw new IntegrationFailure('uncertain', 'The created scene could not be confirmed.');
        await this.store.transaction(state => { if (state.obsSetup?.id === preview.id) state.obsSetup.scenes[scene.role] = found.id; });
      });
      for (const source of preview.input.sources) await this.addSource(source, preview.sourceReuse && Object.hasOwn(preview.sourceReuse, source.name) ? preview.sourceReuse[source.name] : undefined);
      if (preview.input.video) await this.step('video-settings', async () => {
        const value = await this.offline();
        await this.production.execute({ kind: 'video-settings', video: preview.input.video, expected: value.context });
      });
      if (preview.input.recordDirectory) await this.step('record-directory', async () => {
        const value = await this.offline();
        await this.production.execute({ kind: 'record-directory', directory: preview.input.recordDirectory, expected: value.context });
      });
      if (preview.input.outputPreset) await this.step('output-preset', async () => {
        const value = await this.offline();
        await this.production.execute({ kind: 'output-preset', ...preview.input.outputPreset, expected: value.context });
      });
      if (preview.input.service) await this.step('stream-service', async () => {
        const value = await this.offline();
        await this.production.execute({ kind: 'stream-service', ...preview.input.service, expected: value.context });
      });
      const liveSceneId = this.snapshot()?.scenes.development;
      const breakSceneId = this.snapshot()?.scenes.brb;
      if (!liveSceneId || !breakSceneId) throw new IntegrationFailure('uncertain', 'The studio scene assignments are incomplete.');
      await this.step('scene-assignments', () => this.obs.configure({ liveSceneId, breakSceneId }));
      await this.step('rehearsal-scene', async () => {
        const value = await this.offline();
        if (value.broadcast.programSceneId !== liveSceneId)
          await this.scenes.execute({ kind: 'scene-switch', sceneId: liveSceneId, expected: value.context });
      });
      await this.store.transaction(state => {
        if (state.obsSetup?.id === preview.id) state.obsSetup.status = 'confirmed';
        recordOperation(state, 'obs-setup-confirmed', 'committed', undefined, 1, preview.id);
      });
      this.current = undefined;
      return { state: this.snapshot()!, liveSceneId, breakSceneId };
    } catch (error) {
      if (recorded) await this.failure(error);
      throw error;
    } finally { this.busy = false; }
  }
  private async addSource(source: ObsSetupSource, existingId?: string): Promise<void> {
    let id = existingId;
    for (const [index, role] of source.roles.entries()) await this.step(`source:${source.name}:${role}`, async () => {
      const sceneId = this.snapshot()?.scenes[role];
      if (!sceneId) throw new IntegrationFailure('validation', 'The selected studio scene is unavailable.');
      if (index === 0 && !id) {
        const value = await this.offline();
        const result = await this.production.execute({ kind: 'input-create', name: source.name, inputKind: source.inputKind, settings: source.settings, enabled: source.enabled, sceneId, expected: value.context });
        id = result.inputs.find(item => item.name === source.name)?.id;
        if (!id) throw new IntegrationFailure('uncertain', 'The created source could not be confirmed.');
      } else {
        const detail = await this.scenes.inspect(sceneId);
        const member = detail.items.find(item => item.name === source.name);
        if (member) {
          if (member.enabled !== source.enabled) await this.scenes.execute({ kind: 'item-visible', sceneId, itemId: member.id, enabled: source.enabled, expected: detail.context });
          return;
        }
        const found = detail.sources.find(item => item.name === source.name && item.kind === 'input');
        if (!found) throw new IntegrationFailure('validation', 'The shared source is unavailable. Refresh OBS.');
        await this.scenes.execute({ kind: 'item-add', sceneId, sourceId: found.id, expected: detail.context });
        if (!source.enabled) {
          const updated = await this.scenes.inspect(sceneId);
          const item = updated.items.find(item => item.name === source.name);
          if (!item) throw new IntegrationFailure('uncertain', 'The source membership could not be confirmed.');
          await this.scenes.execute({ kind: 'item-visible', sceneId, itemId: item.id, enabled: false, expected: updated.context });
        }
      }
    });
  }
  private async offline() {
    this.open();
    const value = await this.production.inspect();
    this.open();
    if (value.broadcast.active || value.recording?.active || value.replayBuffer?.active || value.virtualCamera?.active
      || value.outputActivity !== false || value.broadcast.reconnecting || value.broadcast.transitioning)
      throw new IntegrationFailure('validation', 'Observe OBS with broadcasting, recording, replay buffer and virtual camera stopped before studio setup.');
    return value;
  }
  private async step(label: string, work: () => Promise<unknown>): Promise<void> {
    await this.offline();
    await this.store.transaction(state => { if (state.obsSetup) state.obsSetup.pendingStep = label; });
    this.open();
    await work();
    this.open();
    await this.store.transaction(state => {
      if (!state.obsSetup) throw new IntegrationFailure('uncertain', 'Studio setup changed during an action.');
      state.obsSetup.completed.push(label);
      delete state.obsSetup.pendingStep;
    });
  }
  private async failure(error: unknown): Promise<void> {
    const uncertain = !(error instanceof IntegrationFailure) || error.kind === 'uncertain';
    try {
      await this.store.transaction(state => {
        if (state.obsSetup) {
          state.obsSetup.status = uncertain ? 'uncertain' : 'failed';
          state.obsSetup.lastError = uncertain ? 'An OBS setup action is unconfirmed. Inspect existing scenes and sources; nothing will replay.' : 'Setup stopped. Completed steps remain applied. Inspect OBS before preparing a new preview.';
        }
        recordOperation(state, 'obs-setup-failed', uncertain ? 'uncertain' : 'none');
      });
    } catch { /* Durable pending setup and OBS intent survive for explicit recovery. */ }
  }
  async recover(): Promise<ObsSetupState | undefined> {
    this.open();
    if (this.busy) throw new IntegrationFailure('validation', 'Wait for studio setup to finish.');
    await this.production.inspect();
    await this.store.transaction(state => {
      if (state.obsSetup && ['running', 'failed', 'uncertain'].includes(state.obsSetup.status)) state.obsSetup.status = 'acknowledged';
    });
    this.current = undefined;
    return this.snapshot();
  }
}
