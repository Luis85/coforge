import { IntegrationFailure } from '../domain/integration-failure';
import { TWITCH_ACTIONS, TWITCH_RESOURCES } from '../domain/twitch-operations-catalogue';
import { twitchDetailsCheck, twitchScopeGranted, validateTwitchAction } from '../domain/twitch-operations-validation';
import { emptyTwitchOperations, type TwitchAction, type TwitchActionPreview, type TwitchActivity, type TwitchOperationContext, type TwitchOperationsPort, type TwitchOperationsSnapshot, type TwitchOperationsState, type TwitchParameters, type TwitchResource, type TwitchResourceSnapshot } from '../domain/twitch-operations';
import type { InternalState } from './ports';
import type { StudioStore } from './studio-store';
import { recordOperation } from './population';

const currentState = (state: InternalState) => state.twitchOperations ??= emptyTwitchOperations();
const failure = (message: string) => new IntegrationFailure('validation', message);
const sameContext = (a: Pick<TwitchOperationContext, 'channelId' | 'accountId' | 'clientId'>, b: TwitchOperationContext) => a.channelId === b.channelId && a.accountId === b.accountId && a.clientId === b.clientId;
const sameReadContext = (a: TwitchOperationContext, b: TwitchOperationContext) => sameContext(a, b) && a.scopes.length === b.scopes.length && a.scopes.every(scope => b.scopes.includes(scope));
const safeError = (error: unknown) => error instanceof IntegrationFailure ? error.message.slice(0, 1000) : 'Twitch data could not be refreshed. Try again.';

/** Explicit reviewed actions have durable intent, one serialized sender and no uncertain replay. */
export class TwitchOperations {
  private readonly previews = new Map<string, TwitchActionPreview>();
  private readonly listeners = new Set<() => void>();
  private readonly resources = new Map<TwitchResource, { context: TwitchOperationContext; value: TwitchResourceSnapshot }>();
  private pending: Promise<unknown> = Promise.resolve();
  private stopStore?: () => void;
  private closed = false;
  constructor(private readonly store: StudioStore, private readonly port: TwitchOperationsPort, private readonly context: () => TwitchOperationContext) {}
  start(): void { this.assertOpen(); if (!this.stopStore) this.stopStore = this.store.subscribeChanges(() => this.emit()); }
  async dispose(): Promise<void> { this.closed = true; this.previews.clear(); await this.pending; await this.store.flush(); this.stopStore?.(); this.stopStore = undefined; this.resources.clear(); this.listeners.clear(); }
  subscribe(listener: () => void): () => void { this.assertOpen(); this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  invalidateResources(): void { this.resources.clear(); this.previews.clear(); this.emit(); }
  snapshot(): TwitchOperationsSnapshot {
    const context = this.context(); const state = this.store.snapshot().twitchOperations ?? emptyTwitchOperations();
    const activities = state.activities.filter(item => item.channelId === context.channelId);
    return structuredClone({ ...state, activities, intents: state.intents.filter(item => item.channelId === context.channelId), gaps: state.gaps.filter(item => item.channelId === context.channelId),
      resources: Object.fromEntries([...this.resources].filter(([, entry]) => sameReadContext(entry.context, context)).map(([name, entry]) => [name, entry.value.status === 'ready' && (name === 'activity' || name === 'automod-queue') ? { ...entry.value, result: localRecords(name, activities) } : entry.value])),
      capabilities: TWITCH_RESOURCES.map(item => { const missingScopes = item.scopes.filter(scope => !twitchScopeGranted(context.scopes, scope)); return { resource: item.name, label: item.label, available: /^\d+$/.test(context.channelId) && context.accountId === context.channelId && Boolean(context.clientId) && !missingScopes.length, missingScopes, ...(item.note ? { note: item.note } : {}) }; }),
    });
  }
  preview(input: TwitchAction): TwitchActionPreview {
    this.assertOpen(); const action = validateTwitchAction(input); const context = this.context(); this.assertAllowed(action, context);
    if (action.name === 'raid-start' && action.parameters.to_broadcaster_id === context.channelId) throw failure('Choose another channel for the raid.');
    const preview: TwitchActionPreview = { id: crypto.randomUUID(), channelId: context.channelId, accountId: context.accountId, clientId: context.clientId, action, createdAt: new Date().toISOString() };
    for (const [id, saved] of this.previews) if (Date.now() - Date.parse(saved.createdAt) > 300_000) this.previews.delete(id);
    if (this.previews.size >= 100) throw failure('Close unused action reviews before preparing another.');
    this.previews.set(preview.id, structuredClone(preview)); return structuredClone(preview);
  }
  execute(input: TwitchActionPreview): Promise<string> {
    const preview = structuredClone(input); const work = this.pending.then(() => this.send(preview));
    this.pending = work.catch(() => undefined); return work;
  }
  private async send(preview: TwitchActionPreview): Promise<string> {
    this.assertOpen(); const context = this.context();
    if (!sameContext(preview, context)) throw failure('The Twitch account or channel changed. Review this action again.');
    const saved = this.previews.get(preview.id);
    if (!saved || JSON.stringify(saved) !== JSON.stringify(preview)) throw failure('This review has already been used or changed. Review the action again.');
    if (Date.now() - Date.parse(preview.createdAt) > 300_000) throw failure('This review expired. Review current Twitch details again.');
    this.assertAllowed(preview.action, context);
    await this.store.transaction(state => {
      const operations = currentState(state);
      prune(operations);
      if (operations.intents.some(item => item.id === preview.id)) throw failure('This action was already submitted.');
      if (operations.intents.some(item => item.channelId === preview.channelId && (item.status === 'sending' || item.status === 'uncertain') && !item.reviewedAt)) throw failure('A previous Twitch action is unconfirmed. Inspect Twitch and acknowledge its recovery record first.');
      if (!sameContext(preview, this.context())) throw failure('The Twitch account or channel changed. Review this action again.');
      if (operations.intents.length >= 1000) throw failure('Review and clear retained Twitch action history before sending another action.');
      operations.intents.push({ ...preview, status: 'sending' });
      recordOperation(state, 'twitch-operation-requested', 'none', undefined, 1, preview.id);
    });
    this.previews.delete(preview.id);
    let applied = false;
    try {
      if (!sameContext(preview, this.context()) || this.closed) throw failure('The Twitch connection changed before sending. Review again.');
      this.assertAllowed(preview.action, this.context());
      const result = await this.port.execute(preview.action); applied = true;
      if (!sameContext(preview, this.context())) throw new IntegrationFailure('uncertain', 'The Twitch account changed while the action was in flight. Inspect its original channel.');
      await this.store.transaction(state => {
        const intent = currentState(state).intents.find(item => item.id === preview.id);
        if (intent) {
          intent.status = 'confirmed'; intent.finishedAt = new Date().toISOString(); intent.completion = preview.action.name === 'clip-create' || preview.action.name === 'raid-start' ? 'accepted' : 'completed';
          if (result?.records[0]) {
            const receipt: TwitchParameters = {};
            for (const [key, value] of Object.entries(result.records[0]).slice(0, 30)) if (/^[a-zA-Z0-9_]{1,50}$/.test(key) && (typeof value === 'string' && value.length <= 2000 || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean')) receipt[key] = value;
            intent.receipt = receipt;
          }
          recordOperation(state, 'twitch-operation-confirmed', 'committed', undefined, 1, preview.id);
        }
      });
      this.resources.delete(TWITCH_ACTIONS.find(item => item.name === preview.action.name)!.resource); this.emit();
      return preview.id;
    } catch (error) {
      const uncertain = applied || !(error instanceof IntegrationFailure) || error.kind === 'uncertain';
      try { await this.store.transaction(state => { const intent = currentState(state).intents.find(item => item.id === preview.id); if (intent) { intent.status = uncertain ? 'uncertain' : 'failed'; intent.finishedAt = new Date().toISOString(); intent.error = error instanceof IntegrationFailure ? error.message.slice(0, 1000) : 'Twitch did not confirm the action. Inspect the channel before continuing.'; recordOperation(state, uncertain ? 'twitch-operation-uncertain' : 'twitch-operation-failed', uncertain ? 'uncertain' : 'none', undefined, 1, preview.id); } }); } catch { /* The durable sending intent remains uncertain after restart; never resend. */ }
      this.emit(); throw error;
    }
  }
  async refresh(resource: TwitchResource, parameters: TwitchParameters = {}): Promise<void> {
    this.assertOpen(); const context = structuredClone(this.context());
    const descriptor = TWITCH_RESOURCES.find(item => item.name === resource);
    if (!descriptor) throw failure('Unknown Twitch dataset.');
    if (!context.channelId || context.channelId !== context.accountId || !context.clientId) throw failure('Connect the intended Twitch broadcaster before refreshing.');
    if (descriptor.scopes.some(scope => !twitchScopeGranted(context.scopes, scope))) throw new IntegrationFailure('permission', 'Enable this feature and reconnect Twitch to grant its read permission.');
    const selection = structuredClone(parameters);
    const entry = { context, value: { status: 'loading' as const, parameters: selection } }; this.resources.set(resource, entry); this.emit();
    try {
      const activities = this.snapshot().activities;
      const result = resource === 'activity' || resource === 'automod-queue'
        ? localRecords(resource, activities)
        : await this.port.read(resource, selection);
      if (this.closed || !sameReadContext(context, this.context()) || this.resources.get(resource) !== entry) return;
      this.resources.set(resource, { context, value: { status: 'ready', checkedAt: new Date().toISOString(), result, parameters: selection } }); this.emit();
    } catch (error) {
      if (!this.closed && sameReadContext(context, this.context()) && this.resources.get(resource) === entry) { this.resources.set(resource, { context, value: { status: 'unavailable', checkedAt: new Date().toISOString(), error: safeError(error), parameters: selection } }); this.emit(); }
      throw error;
    }
  }
  async ingest(input: TwitchActivity): Promise<void> {
    this.assertOpen(); const context = this.context();
    if (input.channelId !== context.channelId || !input.id || !input.type || !Number.isFinite(Date.parse(input.at))) return;
    await this.store.transaction(state => {
      if (input.channelId !== this.context().channelId) return;
      const operations = currentState(state);
      if (operations.activities.some(item => item.id === input.id && item.channelId === input.channelId)) return;
      const activity: TwitchActivity = { id: input.id.slice(0, 200), channelId: input.channelId, type: input.type.slice(0, 100), at: input.at, summary: input.summary.slice(0, 1000), ...(input.actorId ? { actorId: input.actorId.slice(0, 100) } : {}), ...(input.actorName ? { actorName: input.actorName.slice(0, 100) } : {}), ...(input.amount !== undefined && Number.isFinite(input.amount) && input.amount >= 0 ? { amount: input.amount } : {}), ...(input.streamId ? { streamId: input.streamId.slice(0, 100) } : {}) };
      if (input.details) activity.details = twitchDetailsCheck(input.details);
      operations.activities.push(activity); prune(operations);
      recordOperation(state, 'twitch-activity-observed', 'committed', undefined, 1, activity.id);
    }); this.emit();
  }
  async acknowledgeActivity(id: string): Promise<void> {
    this.assertOpen();
    const channelId = this.context().channelId;
    await this.store.transaction(state => { const activity = currentState(state).activities.find(item => item.id === id && item.channelId === channelId); if (!activity) throw failure('This activity is not available in the selected channel.'); if (!activity.acknowledgedAt) { activity.acknowledgedAt = new Date().toISOString(); recordOperation(state, 'twitch-activity-acknowledged', 'committed', undefined, 1, id); } }); this.emit();
  }
  async linkActivity(id: string, ideaId: string): Promise<void> {
    this.assertOpen();
    const channelId = this.context().channelId;
    await this.store.transaction(state => {
      const activity = currentState(state).activities.find(item => item.id === id && item.channelId === channelId);
      const idea = state.ideas.find(item => item.id === ideaId);
      if (!activity || !idea || !idea.screening || idea.screening.verdict !== 'clear' || ['inbox', 'flagged', 'rejected'].includes(idea.status)) throw failure('Choose an existing screened request and a current-channel activity.');
      activity.linkedIdeaId = idea.id; activity.linkedProjectId = idea.projectId;
      recordOperation(state, 'twitch-activity-linked', 'committed', undefined, 1, idea.id);
    }); this.emit();
  }
  async saveTemplate(name: string, input: TwitchAction, id?: string): Promise<string> {
    this.assertOpen();
    const action = validateTwitchAction(input);
    if (!name.trim() || name.length > 100) throw failure('Give this action template a name of 1–100 characters.');
    const templateId = id ?? crypto.randomUUID();
    await this.store.transaction(state => {
      const operations = currentState(state); const templates = operations.templates ??= [];
      const index = templates.findIndex(item => item.id === templateId);
      if (id && index < 0) throw failure('The selected action template no longer exists.');
      if (index < 0 && templates.length >= 100) throw failure('Remove an unused template before saving another.');
      const template = { id: templateId, name: name.trim(), action, updatedAt: new Date().toISOString() };
      if (index < 0) templates.push(template); else templates[index] = template;
      recordOperation(state, 'twitch-template-saved', 'committed', undefined, 1, templateId);
    }); this.emit(); return templateId;
  }
  async removeTemplate(id: string): Promise<void> {
    this.assertOpen();
    await this.store.transaction(state => { const operations = currentState(state); const known = operations.templates?.some(item => item.id === id); operations.templates = operations.templates?.filter(item => item.id !== id); if (known) recordOperation(state, 'twitch-template-removed', 'committed', undefined, 1, id); }); this.emit();
  }
  async reconcile(id: string, note: string): Promise<void> {
    this.assertOpen();
    if (!note.trim() || note.length > 1000) throw failure('Record a short note after inspecting Twitch.');
    const context = this.context();
    if (!/^\d+$/.test(context.channelId) || context.accountId !== context.channelId || !context.clientId) throw failure('Connect the original broadcaster before inspecting this action.');
    await this.store.transaction(state => { const intent = currentState(state).intents.find(item => item.id === id && item.channelId === context.channelId && item.accountId === context.accountId); if (!intent || intent.status !== 'uncertain') throw failure('Select an uncertain action for this Twitch account.'); intent.reviewedAt = new Date().toISOString(); intent.reviewNote = note.trim(); recordOperation(state, 'twitch-operation-inspected', 'committed', undefined, 1, id); }); this.emit();
  }
  async setRetention(days: number): Promise<void> {
    this.assertOpen();
    if (!Number.isInteger(days) || days < 1 || days > 365) throw failure('Choose retention between 1 and 365 days.');
    await this.store.transaction(state => { const operations = currentState(state); operations.retentionDays = days; prune(operations); recordOperation(state, 'twitch-retention-updated'); }); this.emit();
  }
  async collectionDisconnected(reason = 'Twitch collection disconnected'): Promise<void> {
    this.assertOpen();
    const context = this.context(); if (!/^\d+$/.test(context.channelId)) return;
    await this.store.transaction(state => { const operations = currentState(state); if (operations.gaps.some(item => item.channelId === context.channelId && !item.endedAt)) return; operations.gaps.push({ channelId: context.channelId, startedAt: new Date().toISOString(), reason: reason.slice(0, 250) }); operations.gaps = operations.gaps.slice(-500); }); this.emit();
  }
  async collectionConnected(): Promise<void> {
    this.assertOpen();
    const channelId = this.context().channelId;
    await this.store.transaction(state => { for (const gap of currentState(state).gaps) if (gap.channelId === channelId && !gap.endedAt) gap.endedAt = new Date().toISOString(); }); this.emit();
  }
  report(streamId?: string): string {
    const snapshot = this.snapshot(); const counts = new Map<string, number>();
    for (const activity of snapshot.activities.filter(item => !streamId || item.streamId === streamId)) counts.set(activity.type, (counts.get(activity.type) ?? 0) + 1);
    return ['# Private Twitch activity report', '', `Channel: ${this.context().channelId || 'Not connected'}`, `Retention: ${snapshot.retentionDays} days`, '', ...[...counts].map(([type, count]) => `- ${type}: ${count}`), '', `Collection gaps: ${snapshot.gaps.length}. Missed events are not reconstructed.`, `Unconfirmed actions: ${snapshot.intents.filter(item => item.status === 'uncertain').length}.`, '', 'Observed activity is not a complete Twitch analytics or revenue report.'].join('\n');
  }
  private assertAllowed(action: TwitchAction, context: TwitchOperationContext): void {
    if (!/^\d+$/.test(context.channelId) || context.accountId !== context.channelId || !context.clientId) throw failure('Connect the intended Twitch broadcaster before reviewing an action.');
    const descriptor = TWITCH_ACTIONS.find(item => item.name === action.name)!;
    if (descriptor.scopes.some(scope => !twitchScopeGranted(context.scopes, scope))) throw new IntegrationFailure('permission', 'Enable this feature and reconnect Twitch to grant its action permission.');
  }
  private assertOpen(): void { if (this.closed) throw failure('Twitch operations closed. Reopen CoForge before continuing.'); }
  private emit(): void { for (const listener of this.listeners) { try { listener(); } catch { /* An observer cannot change a committed action. */ } } }
}

function localRecords(resource: 'activity' | 'automod-queue', activities: readonly TwitchActivity[]) {
  const messageId = (item: TwitchActivity) => item.details?.message_id ?? item.details?.msg_id;
  const resolved = new Set(activities.filter(item => item.type === 'automod.message.update').map(messageId));
  return { records: activities.filter(item => resource === 'activity' || item.type === 'automod.message.hold' && typeof messageId(item) === 'string' && !resolved.has(messageId(item))).map(item => ({ ...item.details, ...item })) };
}

function prune(state: TwitchOperationsState): void {
  const cutoff = Date.now() - state.retentionDays * 86_400_000;
  state.activities = state.activities.filter(item => Date.parse(item.at) >= cutoff).slice(-2000);
  state.intents = state.intents.filter(item => item.status === 'sending' || item.status === 'uncertain' && !item.reviewedAt || Date.parse(item.createdAt) >= cutoff);
  state.gaps = state.gaps.filter(item => !item.endedAt || Date.parse(item.endedAt) >= cutoff).slice(-500);
}
