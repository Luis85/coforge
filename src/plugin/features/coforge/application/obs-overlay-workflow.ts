import type { ObsOverlayCandidates, ObsOverlayDefinition, ObsOverlayPreview } from '../domain/obs-overlay';
import { obsOverlayDefinitionCheck } from '../domain/obs-overlay';
import { overlayPublicBoard, overlayPublicContributors, overlayText } from '../domain/obs-overlay-content';
import { projectIsPublic } from '../domain/project-publicity';
import { emptyObsShow } from '../domain/obs-show';
import { boolean, shape, text } from '../domain/check';
import { IntegrationFailure } from '../domain/integration-failure';
import type { StudioStore } from './studio-store';
import type { ObsProductionActions } from './obs-production-workflow';
import type { ObsProductionSnapshot, ObsProductionInput } from '../domain/obs-production';
import { obsTextInputKind, obsTextFileFlag } from '../domain/obs-production';
import { recordOperation } from './population';
export interface ObsOverlayActions {
  snapshot(): ObsOverlayDefinition[];
  candidates(projectId: string): Promise<ObsOverlayCandidates>;
  preview(input: unknown): Promise<ObsOverlayPreview>;
  publish(input: unknown): Promise<ObsOverlayDefinition[]>;
  refreshOverlay(id: string): Promise<void>;
  clear(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}
const supported = (input: ObsProductionInput) => obsTextInputKind(input.kind);
const literal = (input: ObsProductionInput, value: string) => ({ text: value, [obsTextFileFlag(input.kind) ?? 'read_from_file']: false });
/** Explicit public projections written through the same durable OBS admission and recovery boundary. */
export class ObsOverlayWorkflow implements ObsOverlayActions {
  private current?: { value: ObsOverlayPreview; context: ObsProductionSnapshot['context']; inputKind: string };
  private busy = false;
  private closed = false;
  private handling = false;
  private unsubscribe = () => {};
  private lifecycle = 0;
  constructor(private readonly store: StudioStore, private readonly production: Pick<ObsProductionActions, 'inspect' | 'execute'>) {}
  async start(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    this.closed = true;
    this.unsubscribe();
    await this.store.transaction(state => {
      for (const mapping of state.obsShow?.overlays ?? []) if (mapping.publication?.status === 'publishing') mapping.publication.status = 'uncertain';
    });
    if (lifecycle !== this.lifecycle) return;
    this.closed = false;
    this.unsubscribe = this.store.subscribeChanges(() => { void this.revokeChanged().catch(() => undefined); });
    await this.revokeChanged();
  }
  dispose(): void { this.lifecycle++; this.closed = true; this.unsubscribe(); this.current = undefined; }
  private open(lifecycle = this.lifecycle): void { if (this.closed || lifecycle !== this.lifecycle) throw new IntegrationFailure('validation', 'Reopen CoForge before managing public overlays.'); }
  snapshot(): ObsOverlayDefinition[] { return this.store.snapshot().obsShow?.overlays ?? []; }
  async candidates(projectId: string): Promise<ObsOverlayCandidates> {
    this.open();
    const state = this.store.snapshot();
    const production = await this.production.inspect();
    const result: ObsOverlayCandidates = {
      projects: (state.projects ?? []).filter(project => projectIsPublic(state, project.id)).slice(0, 100).map(project => ({ id: project.id, name: project.settings.projectName })),
      requests: [], increments: [], recognition: [], inputs: production.inputs.filter(supported).map(input => ({ id: input.id, name: input.name })),
    };
    if (!projectId) return result;
    const board = overlayPublicBoard(state, projectId);
    result.requests = board.columns.flatMap(column => column.ideas).slice(0, 500).map(idea => ({ id: idea.id, name: `${idea.id} · ${idea.title}` }));
    result.increments = board.columns.filter(column => column.id === 'done').flatMap(column => column.ideas).slice(0, 500).map(idea => ({ id: idea.id, name: `${idea.id} · ${idea.title}` }));
    result.recognition = overlayPublicContributors(state).slice(0, 500).map(person => ({ id: person.id, name: person.name }));
    return result;
  }
  private definition(input: unknown): ObsOverlayDefinition {
    const value = obsOverlayDefinitionCheck(input);
    if (value.kind === 'now-playing') throw new IntegrationFailure('validation', 'Music uses OBS media sources. Clear or remove this legacy overlay.');
    delete value.publication;
    if (this.snapshot().some(mapping => mapping.id !== value.id && mapping.inputId === value.inputId))
      throw new IntegrationFailure('validation', 'Another saved overlay owns this OBS text source. Choose a different source.');
    return value;
  }
  private async resolve(definition: ObsOverlayDefinition) {
    const state = await this.production.inspect();
    const input = state.inputs.find(input => input.id === definition.inputId);
    if (!input || !supported(input) || !state.available.includes('input-settings'))
      throw new IntegrationFailure('validation', 'Choose an available supported OBS text source.');
    const rendered = overlayText(this.store.snapshot(), definition);
    return { state, input, rendered };
  }
  async preview(input: unknown): Promise<ObsOverlayPreview> {
    this.open();
    const lifecycle = this.lifecycle;
    const definition = this.definition(input);
    const resolved = await this.resolve(definition);
    this.open(lifecycle);
    const value: ObsOverlayPreview = { id: crypto.randomUUID(), definition, text: resolved.rendered, inputName: resolved.input.name,
      shared: true, onAir: resolved.state.broadcast.active, switchesFromFile: Boolean(resolved.input.settings.read_from_file || resolved.input.settings.from_file) };
    this.current = { value, context: resolved.state.context, inputKind: resolved.input.kind };
    return structuredClone(value);
  }
  async publish(input: unknown): Promise<ObsOverlayDefinition[]> {
    this.open();
    const lifecycle = this.lifecycle;
    const confirm = shape({ previewId: text({ min: 1, max: 100 }), confirmed: boolean }, { strict: true })(input);
    const captured = this.current;
    if (!confirm.confirmed || !captured || confirm.previewId !== captured.value.id || !captured.value.definition.publicConfirmed)
      throw new IntegrationFailure('validation', 'Preview the exact overlay text and explicitly confirm public display.');
    const definition = this.definition(captured.value.definition);
    const fresh = await this.resolve(definition);
    this.open(lifecycle);
    if (fresh.rendered !== captured.value.text || fresh.input.kind !== captured.inputKind || JSON.stringify(fresh.state.context) !== JSON.stringify(captured.context))
      throw new IntegrationFailure('validation', 'The public content or OBS target changed. Review a new overlay preview.');
    await this.write(definition, fresh);
    this.current = undefined;
    return this.snapshot();
  }
  private async write(definition: ObsOverlayDefinition, resolved: Awaited<ReturnType<ObsOverlayWorkflow['resolve']>>): Promise<void> {
    if (this.busy) throw new IntegrationFailure('validation', 'Another overlay operation is in progress.');
    this.busy = true;
    const lifecycle = this.lifecycle;
    let recorded = false;
    try {
      const previous = this.snapshot().find(mapping => mapping.id === definition.id);
      if (previous && previous.inputId !== definition.inputId && previous.publication?.status !== 'cleared')
        throw new IntegrationFailure('validation', 'Clear the previous owned source before moving this overlay to a different source.');
      if (previous?.publication && ['publishing', 'uncertain', 'revocation-required'].includes(previous.publication.status))
        throw new IntegrationFailure('uncertain', 'Inspect and explicitly clear the previous unconfirmed overlay before publishing another value.');
      await this.store.transaction(state => {
        const show = state.obsShow ??= emptyObsShow();
        const mappings = show.overlays ??= [];
        if (mappings.some(mapping => mapping.id !== definition.id && mapping.inputId === definition.inputId))
          throw new IntegrationFailure('validation', 'This OBS text source is already owned by another overlay.');
        if (!mappings.some(mapping => mapping.id === definition.id) && mappings.length >= 100) throw new IntegrationFailure('validation', 'Remove an overlay before creating another.');
        const next = { ...definition, publication: { status: 'publishing' as const, text: previous?.publication?.text ?? '', pendingText: resolved.rendered, inputKind: resolved.input.kind } };
        show.overlays = [...mappings.filter(mapping => mapping.id !== definition.id), next];
        recordOperation(state, 'obs-overlay-saved', 'none', undefined, 1, definition.id);
      });
      recorded = true;
      this.open(lifecycle);
      if (overlayText(this.store.snapshot(), definition) !== resolved.rendered)
        throw new IntegrationFailure('validation', 'Public visibility changed before the overlay write. Review a new preview.');
      await this.production.execute({ kind: 'input-settings', inputId: definition.inputId, settings: literal(resolved.input, resolved.rendered), expected: resolved.state.context });
      this.open(lifecycle);
      await this.store.transaction(state => {
        const mapping = state.obsShow?.overlays?.find(mapping => mapping.id === definition.id);
        if (mapping) mapping.publication = { status: 'published', text: resolved.rendered, inputKind: resolved.input.kind };
        recordOperation(state, 'obs-overlay-published', 'committed', undefined, 1, definition.id);
      });
    } catch (error) {
      if (recorded) await this.mark(definition.id, 'uncertain').catch(() => undefined);
      throw error;
    } finally { this.busy = false; }
  }
  async refreshOverlay(id: string): Promise<void> {
    this.open();
    const mapping = this.snapshot().find(mapping => mapping.id === id);
    if (!mapping || !mapping.publicConfirmed) throw new IntegrationFailure('validation', 'Choose an approved saved overlay mapping.');
    if (!this.publiclyAvailable(mapping)) {
      await this.clear(id);
      throw new IntegrationFailure('validation', 'The public source was revoked. Its owned OBS text was cleared.');
    }
    const definition = this.definition(mapping);
    const resolved = await this.resolve(mapping);
    this.open();
    const current = this.snapshot().find(value => value.id === id);
    if (!current || JSON.stringify(this.definition(current)) !== JSON.stringify(definition))
      throw new IntegrationFailure('validation', 'The saved overlay mapping changed during refresh. Review the current definition.');
    await this.write(definition, resolved);
  }
  private publiclyAvailable(mapping: ObsOverlayDefinition): boolean {
    try { overlayText(this.store.snapshot(), mapping); return true; } catch { return false; }
  }
  private async mark(id: string, status: 'revocation-required' | 'uncertain' | 'cleared'): Promise<void> {
    await this.store.transaction(state => {
      const mapping = state.obsShow?.overlays?.find(mapping => mapping.id === id);
      if (!mapping?.publication) return;
      mapping.publication.status = status;
      if (status === 'cleared') { mapping.publication.text = ''; delete mapping.publication.pendingText; }
      recordOperation(state, status === 'cleared' ? 'obs-overlay-cleared' : 'obs-overlay-revocation-required', status === 'uncertain' ? 'uncertain' : 'committed', undefined, 1, id);
    });
  }
  async clear(id: string): Promise<void> {
    this.open();
    const lifecycle = this.lifecycle;
    const mapping = this.snapshot().find(mapping => mapping.id === id);
    if (!mapping?.publication || mapping.publication.status === 'cleared') return;
    await this.mark(id, 'revocation-required');
    if (this.busy) throw new IntegrationFailure('validation', 'Overlay clearing is required after the current operation finishes.');
    this.busy = true;
    let sent = false;
    try {
      const state = await this.production.inspect();
      const input = state.inputs.find(input => input.id === mapping.inputId);
      const expected = [mapping.publication.text, mapping.publication.pendingText].filter(value => value !== undefined);
      if (input?.kind === mapping.publication.inputKind && input.settings.text === '' && input.settings.read_from_file !== true && input.settings.from_file !== true) {
        await this.mark(id, 'cleared');
        return;
      }
      if (!input || input.kind !== mapping.publication.inputKind || !expected.includes(String(input.settings.text ?? '')) || input.settings.read_from_file === true || input.settings.from_file === true)
        throw new IntegrationFailure('validation', 'The OBS source was removed or edited externally. Clear its content in OBS; CoForge will not overwrite it.');
      this.open(lifecycle);
      sent = true;
      await this.production.execute({ kind: 'input-settings', inputId: mapping.inputId, settings: literal(input, ''), expected: state.context });
      await this.mark(id, 'cleared');
    } catch (error) {
      if (sent && (!(error instanceof IntegrationFailure) || error.kind === 'uncertain')) await this.mark(id, 'uncertain').catch(() => undefined);
      throw error;
    } finally { this.busy = false; }
  }
  async remove(id: string): Promise<void> {
    this.open();
    await this.clear(id);
    this.open();
    if (this.busy) throw new IntegrationFailure('validation', 'Wait for the current overlay operation before removing its mapping.');
    this.busy = true;
    try {
      await this.store.transaction(state => {
        const current = state.obsShow?.overlays?.find(mapping => mapping.id === id);
        if (current?.publication && current.publication.status !== 'cleared')
          throw new IntegrationFailure('uncertain', 'The overlay changed after clearing. Inspect the current source before removing its mapping.');
        if (state.obsShow) state.obsShow.overlays = state.obsShow.overlays?.filter(mapping => mapping.id !== id);
        recordOperation(state, 'obs-overlay-removed', 'committed', undefined, 1, id);
      });
    } finally { this.busy = false; }
  }
  private async revokeChanged(): Promise<void> {
    if (this.closed || this.handling) return;
    this.handling = true;
    try {
      const revoked = this.snapshot().filter(mapping => mapping.publication?.status === 'published' && !this.publiclyAvailable(mapping));
      for (const mapping of revoked) {
        if (this.closed) return;
        const current = this.snapshot().find(value => value.id === mapping.id);
        if (!current || current.publication?.status !== 'published' || this.publiclyAvailable(current)) continue;
        await this.mark(mapping.id, 'revocation-required');
        const pending = this.snapshot().find(value => value.id === mapping.id);
        if (!pending || this.publiclyAvailable(pending)) continue;
        try { await this.clear(mapping.id); } catch { /* The durable clear requirement remains visible; automatic effects are not replayed. */ }
      }
    } finally { this.handling = false; }
  }
}
