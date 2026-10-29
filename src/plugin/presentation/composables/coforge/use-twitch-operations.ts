import { computed, inject, onBeforeUnmount, provide, reactive, shallowRef, watch, type InjectionKey } from 'vue';
import { TWITCH_ACTIONS, TWITCH_RESOURCES } from '../../../features/coforge/domain/twitch-operations-catalogue';
import { emptyTwitchOperations, type TwitchActionName, type TwitchOperationsSnapshot } from '../../../features/coforge/domain/twitch-operations';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { TWITCH_OPERATION_PAGES, useTwitchOperationsStore, type TwitchOperationPage } from '../../stores/coforge-twitch-operations';
import { twitchActionParameters, twitchDisplayValue, twitchDraft, twitchFieldLabel, twitchPublicPlanDraft, twitchRecordFields } from './twitch-operations-display';
import { twitchScopeGranted } from '../../../features/coforge/domain/twitch-operations-validation';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { twitchStreamReport } from '../../../features/coforge/domain/twitch-stream-report';

const twitchOperationsKey: InjectionKey<TwitchOperationsViewModel> = Symbol('twitch-operations-view');

export function useTwitchOperations() {
  const { host, studio: application } = useCoforge();
  const studio = useStudioStore();
  const store = useTwitchOperationsStore();
  const service = host.twitchOperations;
  const empty: TwitchOperationsSnapshot = { ...emptyTwitchOperations(), resources: {}, capabilities: [] };
  const snapshot = shallowRef(service?.snapshot() ?? empty);
  const update = () => { snapshot.value = service ? { ...service.snapshot() } : empty; };
  const stop = service?.subscribe(update) ?? (() => {});
  onBeforeUnmount(stop);
  const connection = computed(() => studio.state ? application.integration() : defaultIntegration());
  store.retentionDays = snapshot.value.retentionDays;
  const page = computed(() => TWITCH_OPERATION_PAGES.find(item => item.id === store.page));
  const resources = computed(() => TWITCH_RESOURCES.filter(item => page.value?.resources.some(name => name === item.name)));
  const descriptor = computed(() => TWITCH_ACTIONS.find(item => item.name === store.action));
  const actions = computed(() => TWITCH_ACTIONS.filter(item => {
    if (store.page === 'activity') return item.name === 'announcement' || item.name === 'shoutout';
    if (store.page === 'moderation') return resources.value.some(resource => resource.name === item.resource) || item.name === 'warn';
    if (store.page === 'broadcast') return ['commercial', 'ad-snooze', 'raid-start', 'raid-cancel'].includes(item.name);
    return resources.value.some(resource => resource.name === item.resource);
  }));
  const draft = computed(() => {
    const selected = descriptor.value;
    if (!selected) return {};
    if (!store.drafts[selected.name]) store.drafts[selected.name] = twitchDraft(selected);
    return store.drafts[selected.name] ?? {};
  });
  const selectedResource = computed(() => TWITCH_RESOURCES.find(item => item.name === store.resource));
  const resourceState = computed(() => {
    const state = snapshot.value.resources[store.resource];
    if (store.resource === 'redemptions' && state?.parameters && (state.parameters.reward_id !== store.query.reward_id || state.parameters.status !== store.query.status)) return undefined;
    return state;
  });
  const scopes = computed(() => studio.state?.runtime.twitch?.streamer?.scopes ?? []);
  const missingActionScopes = computed(() => descriptor.value?.scopes.filter(scope => !twitchScopeGranted(scopes.value, scope)) ?? []);
  const missingReadScopes = computed(() => selectedResource.value?.scopes.filter(scope => !twitchScopeGranted(scopes.value, scope)) ?? []);
  const pending = computed(() => snapshot.value.intents.filter(intent => (intent.status === 'sending' || intent.status === 'uncertain') && !intent.reviewedAt));
  const records = computed(() => resourceState.value?.result?.records ?? []);
  const activities = computed(() => snapshot.value.activities.filter(item => !store.activityFilter || `${item.type} ${item.summary} ${item.actorName ?? ''}`.toLocaleLowerCase().includes(store.activityFilter.toLocaleLowerCase())).slice().reverse());
  const rewardOptions = computed(() => (snapshot.value.resources.rewards?.result?.records ?? []).flatMap(record => typeof record.id === 'string' ? [{ id: record.id, title: typeof record.title === 'string' ? record.title : record.id }] : []));
  watch(() => JSON.stringify(draft.value), () => { store.review = null; });
  watch(() => [studio.state?.runtime.twitch?.streamer?.id, studio.state?.runtime.twitch?.channel?.id, connection.value.twitchClientId], () => { store.review = null; store.report = ''; store.raidTarget = null; store.raidPreviewContext = ''; });
  async function run(work: () => Promise<unknown>, message = '') {
    if (store.busy) return;
    store.busy = true; store.error = ''; store.notice = '';
    try { await work(); update(); store.notice = message; }
    catch (problem) { store.error = problem instanceof Error ? problem.message : 'Twitch could not complete this task. Refresh its current state before trying again.'; update(); }
    finally { store.busy = false; }
  }
  function setPage(value: TwitchOperationPage) {
    store.page = value; store.review = null;
    store.resource = resources.value[0]?.name ?? 'activity';
    store.action = actions.value[0]?.name ?? 'announcement';
  }
  function setAction(value: string) {
    const selected = actions.value.find(item => item.name === value);
    if (selected) { store.action = selected.name; store.review = null; }
  }
  function setResource(value: string) {
    const selected = resources.value.find(item => item.name === value);
    if (selected) { store.resource = selected.name; store.query.after = ''; }
  }
  function prepare(event?: Event) {
    event?.preventDefault(); store.error = ''; store.notice = ''; store.review = null;
    if (!service || !descriptor.value) { store.error = 'Twitch operations are available in Obsidian.'; return; }
    if (descriptor.value.name === 'raid-start') {
      const target = store.raidTarget;
      const context = JSON.stringify([connection.value.twitchClientId, connection.value.twitchBroadcasterId, studio.state?.runtime.twitch?.streamer?.id ?? '']);
      const age = target ? Date.now() - Date.parse(target.checkedAt) : NaN;
      if (!target || target.id !== String(draft.value.to_broadcaster_id ?? '') || store.raidPreviewContext !== context || !Number.isFinite(age) || age < 0 || age > 30_000) {
        store.error = 'Preview the current raid target above before reviewing this action.'; return;
      }
    }
    try { store.review = service.preview({ name: descriptor.value.name, parameters: twitchActionParameters(descriptor.value.fields, draft.value) }); }
    catch (problem) { store.error = problem instanceof Error ? problem.message : 'Review the action fields before continuing.'; }
  }
  async function confirm() {
    const reviewed = store.review;
    if (!reviewed || !service) return;
    store.review = null;
    await run(() => service.execute(reviewed), 'Twitch accepted the request. Refresh its data to inspect current status.');
  }
  function refresh(nextPage = false) {
    if (!service) return;
    const parameters = {
      ...(store.resource === 'redemptions' ? { reward_id: store.query.reward_id, status: store.query.status } : {}),
      ...(store.resource === 'unban-requests' ? { status: 'pending' } : {}),
      ...(nextPage && resourceState.value?.result?.cursor ? { after: resourceState.value.result.cursor } : {}),
    };
    void run(() => service.refresh(store.resource, parameters));
  }
  function authorize(feature: string, kind: 'action' | 'resource' = 'resource') {
    if (!service?.authorize) return;
    void run(() => service.authorize!(`${kind}:${feature}`), 'Complete Twitch authorization, then refresh this data.');
  }
  function useRecord(record: Record<string, unknown>) {
    const selected = descriptor.value;
    if (!selected) return;
    for (const field of selected.fields) {
      const reward = record.reward && typeof record.reward === 'object' && 'id' in record.reward ? record.reward.id : undefined;
      const value = field.name === 'msg_id' ? record.msg_id ?? record.message_id
        : field.name === 'unban_request_id' ? record.unban_request_id ?? record.id
        : field.name === 'reward_id' ? record.reward_id ?? reward ?? (store.resource === 'rewards' ? record.id : store.query.reward_id)
        : field.name === 'user_id' ? record.user_id ?? record.actorId : record[field.name];
      if (field.type === 'select' && (typeof value !== 'string' || !field.options?.includes(value))) continue;
      if (typeof value === 'string' || typeof value === 'number') draft.value[field.name] = value;
      else if (typeof value === 'boolean') draft.value[field.name] = String(value);
    }
    if (typeof record.id === 'string' && store.resource === 'rewards') {
      store.query.reward_id = record.id;
      if (selected.fields.some(field => field.name === 'reward_id')) draft.value.reward_id = record.id;
    }
    store.review = null;
    store.notice = 'Selected record added to the action draft. Review every field before confirming.';
  }
  async function lookupUser() {
    const twitch = host.twitch;
    if (!twitch || !store.username.trim()) return;
    await run(async () => {
      const user = await twitch.resolveUser(store.username.trim().replace(/^@/, ''));
      const field = descriptor.value?.fields.find(item => item.name === 'user_id' || item.name === 'to_broadcaster_id');
      if (field) draft.value[field.name] = user.id;
      store.review = null;
      store.notice = `Resolved ${user.login} to Twitch user ${user.id}.`;
    });
  }
  async function loadPlans() {
    const schedule = host.schedule;
    if (schedule) await run(async () => { store.localPlans = (await schedule.list()).filter(note => note.plan.status === 'planned'); });
  }
  function selectPlan() {
    const note = store.localPlans.find(item => item.plan.id === store.selectedPlan);
    if (!note) return;
    setAction('schedule-create');
    Object.assign(draft.value, twitchPublicPlanDraft(note.plan));
    store.notice = 'Public title, time and category copied. Set the duration and review before publishing. Private scripts, project details and OBS settings stay local.';
  }
  function acknowledge(id: string) { if (service) void run(() => service.acknowledgeActivity(id)); }
  function reconcile(id: string) { if (service) void run(() => service.reconcile(id, store.recoveryNotes[id] ?? ''), 'Inspection recorded. The previous action will not be replayed.'); }
  function setRetention() { if (service) void run(() => service.setRetention(store.retentionDays), 'Retention updated.'); }
  function saveTemplate() {
    const save = service?.saveTemplate;
    if (!save || !descriptor.value) return;
    const action = { name: descriptor.value.name, parameters: twitchActionParameters(descriptor.value.fields, draft.value) };
    void run(() => save(store.templateName, action), 'Action template saved. Loading it only prepares a draft.');
  }
  function loadTemplate() {
    const template = snapshot.value.templates?.find(item => item.id === store.templateId);
    if (!template) return;
    const owner = TWITCH_ACTIONS.find(item => item.name === template.action.name);
    if (!owner) return;
    const task = ['raid-start', 'raid-cancel', 'commercial', 'ad-snooze'].includes(owner.name) ? 'broadcast'
      : owner.name === 'warn' ? 'moderation' : owner.name === 'announcement' || owner.name === 'shoutout' ? 'activity' : undefined;
    const destination = TWITCH_OPERATION_PAGES.find(item => task ? item.id === task : item.resources.some(resource => resource === owner.resource));
    if (destination) setPage(destination.id);
    store.action = owner.name;
    store.drafts[owner.name] = Object.fromEntries(Object.entries(template.action.parameters).map(([key, value]) => [key, Array.isArray(value) ? value.join('\n') : typeof value === 'boolean' ? String(value) : value]));
    store.review = null; store.notice = 'Template loaded into the draft. Review it before sending.';
  }
  function removeTemplate() {
    const remove = service?.removeTemplate;
    if (remove && store.templateId) void run(() => remove(store.templateId), 'Template removed.');
  }
  function linkActivity(id: string) {
    const link = service?.linkActivity;
    if (link) void run(() => link(id, store.activityLinks[id] ?? ''), 'Activity linked to the screened request. No workflow was started.');
  }
  async function loadStreams() {
    const history = host.streamHistory;
    const channelId = studio.state?.runtime.twitch?.streamer?.id;
    if (history) await run(async () => {
      if (!channelId) throw new Error('Connect the intended Twitch broadcaster before selecting stream history.');
      store.streams = (await history.list()).filter(stream => stream.channelId === channelId);
    });
  }
  async function exportReport() {
    const report = service?.report;
    if (!report) return;
    await run(async () => {
      const history = store.reportStream && host.streamHistory ? await host.streamHistory.read(store.reportStream) : null;
      if (store.reportStream && !history) throw new Error('The selected stream history is unavailable. Refresh the recorded streams before exporting.');
      if (history && history.channelId !== studio.state?.runtime.twitch?.streamer?.id) throw new Error('This stream belongs to another channel. Select a current-channel stream.');
      store.report = history ? twitchStreamReport(history, snapshot.value) : report();
      await host.saveExport(JSON.stringify({ schema: 'coforge-private-twitch-report/v1', generatedAt: new Date().toISOString(), report: store.report,
        recordedStream: history, content: { clips: snapshot.value.resources.clips ?? null, markers: snapshot.value.resources.markers ?? null },
        contentCoverage: 'Current refreshed channel data; clips and markers are not limited to the selected recorded stream.',
        coverage: 'Observed events and recorded samples only. Collection gaps remain missing; audience activity is not a revenue report.' }, null, 2));
    }, 'Private report exported. It is excluded from public viewer projections.');
  }
  const model = reactive({ store, snapshot, pages: TWITCH_OPERATION_PAGES, resources, actions, descriptor, draft, selectedResource, resourceState, records, activities, rewardOptions,
    supported: Boolean(service), canAuthorize: Boolean(service?.authorize), canLookup: Boolean(host.twitch), canLoadPlans: Boolean(host.schedule),
    channel: computed(() => studio.state?.runtime.twitch?.channel?.name || studio.state?.runtime.twitch?.streamer?.login || 'No channel connected'),
    missingActionScopes, missingReadScopes, pending, setPage, setAction, setResource, prepare, confirm, refresh, authorize, useRecord, lookupUser, loadPlans, selectPlan, acknowledge, reconcile, setRetention,
    recentIntents: computed(() => snapshot.value.intents.slice(-10).reverse()),
    saveTemplate, loadTemplate, removeTemplate, linkActivity, loadStreams, exportReport,
    canReport: Boolean(service?.report), canTemplates: Boolean(service?.saveTemplate), canLink: Boolean(service?.linkActivity), canLoadStreams: Boolean(host.streamHistory),
    screenedRequests: computed(() => studio.state?.ideas.filter(idea => idea.screening?.verdict === 'clear' && !['inbox', 'flagged', 'rejected'].includes(idea.status)) ?? []),
    authorizing: computed(() => Boolean(studio.state?.runtime.twitch?.authorization)),
    connection,
    showLookup: computed(() => descriptor.value?.fields.some(field => field.name === 'user_id' || field.name === 'to_broadcaster_id')),
    fieldLabel: twitchFieldLabel, displayValue: twitchDisplayValue, recordFields: twitchRecordFields,
    actionLabel: (name: TwitchActionName) => TWITCH_ACTIONS.find(item => item.name === name)?.label ?? name,
    time: (value?: string) => value ? new Date(value).toLocaleString() : 'Not collected',
    catalogue: computed(() => TWITCH_RESOURCES.map(item => ({ ...item, capability: snapshot.value.capabilities.find(capability => capability.resource === item.name), state: snapshot.value.resources[item.name] }))),
  });
  provide(twitchOperationsKey, model);
  return model;
}

export type TwitchOperationsViewModel = ReturnType<typeof useTwitchOperations>;

/** Child panels bind the view-owned model without mutating component props. */
export function useTwitchOperationsSection(): TwitchOperationsViewModel {
  const model = inject(twitchOperationsKey, null);
  if (!model) throw new Error('TWITCH_OPERATIONS_CONTEXT_MISSING');
  return model;
}
