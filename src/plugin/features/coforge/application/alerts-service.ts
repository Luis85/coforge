import { AlertDispatchError, alertTemplateCheck, alertsDefinitionCheck, renderAlert, type AlertCue, type AlertsDefinition, type AlertsSnapshot, type AlertTemplate } from '../domain/alerts';
import type { AlertsActions, AlertsStorage, AlertsTransport, AlertsMedia } from './alerts-ports';
import type { OperationCode } from '../domain/population';

/** Definitions are durable; live cues are deliberately ephemeral and never replayed. */
export class AlertsService implements AlertsActions {
  private state: AlertsSnapshot = { version: 1, templates: [], ready: false, url: '', error: '', sources: 0 };
  private readonly listeners = new Set<(state: AlertsSnapshot) => void>();
  private readonly seen = new Set<string>();
  private writing: Promise<void> = Promise.resolve();
  private dispatching: Promise<void> = Promise.resolve();
  private pendingDispatches = 0;
  private closed = false;
  private starting: Promise<void> | undefined;
  private generation = 0;
  private readonly stopSources: () => void;
  constructor(private readonly storage: AlertsStorage, private readonly transport: AlertsTransport, private readonly media: AlertsMedia = { check: async () => {} }) {
    this.stopSources = transport.subscribeSources(sources => {
      if (this.closed) return;
      // A preflight admitted for an old source set must never replay into newly connected pages.
      if (this.state.sources > 0 && sources !== this.state.sources) this.generation++;
      this.state.sources = sources; this.emit();
    });
  }
  snapshot(): AlertsSnapshot { return structuredClone(this.state); }
  subscribe(listener: (state: AlertsSnapshot) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(): void {
    for (const listener of this.listeners) { try { listener(this.snapshot()); } catch { /* A view observer cannot undo a saved definition or cue. */ } }
  }
  start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = this.initialize(); return this.starting;
  }
  private async initialize(): Promise<void> {
    try {
      const definition = alertsDefinitionCheck(await this.storage.load());
      if (this.closed) return;
      // A port conflict must not hide definitions that were loaded successfully.
      this.state.templates = definition.templates; this.emit();
      const url = await this.transport.start();
      if (this.closed) { await this.transport.close(); return; }
      this.state = { ...definition, ready: true, url, error: '', sources: this.state.sources }; this.emit();
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Alerts could not start. Reload after restoring their saved configuration.';
      this.emit(); throw error;
    }
  }
  private available(): void { if (!this.state.ready || this.closed) throw new Error('Alerts are unavailable. Reload CoForge after fixing the startup error.'); }
  private change(update: (current: AlertsDefinition) => AlertsDefinition): Promise<void> {
    const work = this.writing.then(async () => {
      this.available();
      const next = alertsDefinitionCheck(update({ version: 1, templates: structuredClone(this.state.templates) }));
      await this.storage.save(next);
      if (this.closed) return;
      const removedTemplate = this.state.templates.some(previous => !next.templates.some(item => item.id === previous.id));
      const oldMedia = this.paths(this.state.templates);
      const nextMedia = new Set(this.paths(next.templates));
      const revokedMedia = oldMedia.some(path => !nextMedia.has(path));
      this.state.templates = next.templates;
      this.state.error = '';
      if (removedTemplate || revokedMedia) this.clear();
      this.emit();
    });
    this.writing = work.catch(() => {}); return work;
  }
  async save(input: AlertTemplate): Promise<void> {
    const template = alertTemplateCheck(input);
    return this.change(current => {
      return { version: 1, templates: [...current.templates.filter(item => item.id !== template.id), template] };
    });
  }
  remove(id: string): Promise<void> { return this.change(current => ({ version: 1, templates: current.templates.filter(item => item.id !== id) })); }
  private paths(templates: readonly AlertTemplate[]): string[] {
    return [...new Set(templates.flatMap(item => [item.image, item.audio, item.video]).filter(Boolean))];
  }
  fire(id: string, variables: Record<string, string>): Promise<{ sources: number }> {
    return this.prepareDispatch(id, variables);
  }
  private async prepareDispatch(id: string, variables: Record<string, string>): Promise<{ sources: number }> {
    this.available();
    if (!this.state.sources) throw new AlertDispatchError('source', 'No alert source is connected. Add the Alerts URL to an OBS Browser Source and keep it loaded, then try again.');
    const template = this.state.templates.find(item => item.id === id);
    if (!template) throw new Error('This alert no longer exists. Select a saved template.');
    let cue: AlertCue;
    try { cue = renderAlert(template, variables); }
    catch (error) { throw new AlertDispatchError('variables', error instanceof Error ? error.message.slice(0, 240) : 'Supply this alert’s text variables before dispatching.'); }
    if (this.pendingDispatches >= 20) throw new AlertDispatchError('queue', 'The alert dispatch queue is full. Wait for media checks to finish or stop all alerts.');
    const generation = this.generation;
    const checkCurrent = () => {
      this.available();
      if (generation !== this.generation) throw new AlertDispatchError('cancelled', 'This pending alert was cleared. Fire it again when you are ready.');
    };
    this.pendingDispatches++;
    const work = this.dispatching.then(async () => {
      checkCurrent();
      try { await this.media.check(this.paths([template])); }
      catch { throw new AlertDispatchError('media', 'Selected alert media is missing, unreadable or larger than 25 MiB. Restore or reselect its files, then try again.'); }
      checkCurrent();
      const sources = this.transport.send(cue);
      if (!sources) throw new AlertDispatchError('source', 'No alert source is connected. Add the Alerts URL to an OBS Browser Source and keep it loaded, then try again.');
      if (this.state.error) { this.state.error = ''; this.emit(); }
      return { sources };
    }).finally(() => { this.pendingDispatches--; });
    this.dispatching = work.then(() => {}, () => {});
    return work;
  }
  async event(type: OperationCode, identity: string, variables: Record<string, string>): Promise<void> {
    if (!this.state.ready || this.closed || this.seen.has(identity)) return;
    this.seen.add(identity);
    if (this.seen.size > 2000) { const oldest = this.seen.values().next().value; if (oldest !== undefined) this.seen.delete(oldest); }
    if (!this.state.sources) return;
    const generation = this.generation;
    const templates = this.state.templates.filter(item => item.enabled && item.event === type);
    await Promise.all(templates.map(async template => {
      try { await this.fire(template.id, variables); }
      catch (error) {
        if (this.closed || generation !== this.generation) return;
        const reason = error instanceof AlertDispatchError ? error.message : 'The source could not accept this alert. Check the connection and try again.';
        this.state.error = `Alert “${template.name}”: ${reason}`; this.emit();
      }
    }));
  }
  clear(): void { this.generation++; this.transport.clear(); }
  async dispose(): Promise<void> {
    this.closed = true; this.state.ready = false; this.state.url = ''; this.state.sources = 0; this.stopSources(); this.clear();
    await this.starting?.catch(() => {});
    const closing = this.transport.close();
    await this.writing; await this.dispatching; await closing; this.listeners.clear(); this.seen.clear();
  }
}
