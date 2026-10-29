import { computed, nextTick, onBeforeUnmount, reactive, useId } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useAlertsStore } from '../../stores/coforge-alerts';
import {
  ALERT_EVENT_DEFINITIONS, alertEventVariables, alertMediaType, alertVariables, renderAlert,
  type AlertsSnapshot, type AlertTemplate,
} from '../../../features/coforge/domain/alerts';

/** Vue refs and native event targets can belong to a detached Obsidian window. */
function htmlElement(value: unknown): value is HTMLElement {
  return typeof value === 'object' && value !== null && 'nodeType' in value && value.nodeType === 1
    && 'namespaceURI' in value && value.namespaceURI === 'http://www.w3.org/1999/xhtml';
}
function elementTag<K extends keyof HTMLElementTagNameMap>(value: unknown, name: K): value is HTMLElementTagNameMap[K] {
  return htmlElement(value) && value.localName === name;
}

const TWITCH_ALERT_HELP: Readonly<Record<string, string>> = {
  'channel.follow': 'viewer is the follower’s display name when available.',
  'channel.subscribe': 'viewer names the subscriber or gift recipient. Choose the gifted subscriptions event to thank the giver.',
  'channel.subscription.gift': 'amount is the number of subscriptions gifted in this event. viewer names the giver when known. Anonymous gifts omit viewer; use a template without viewer to include them.',
  'channel.subscription.message': 'viewer names the person who shared a resubscription message. Twitch records this message separately from subscription start.',
  'channel.cheer': 'amount is the number of Bits in this cheer. Anonymous cheers omit viewer; use a template without viewer to include them.',
  'channel.raid.incoming': 'viewer names the raiding broadcaster. amount is Twitch’s reported raid viewer count.',
  'channel.raid.outgoing': 'viewer names the destination broadcaster. amount is Twitch’s reported raid viewer count.',
  'channel.channel_points_custom_reward_redemption.add': 'viewer names the redeemer and reward is the reward title. Check fulfillment status in Twitch’s redemption queue.',
  'stream.online': 'Twitch stream status is observed independently from the OBS controls.',
  'stream.offline': 'Twitch stream status is observed independently from the OBS controls.',
};

/** Saved alerts are operated first; editing and first-time source setup stay secondary. */
export function useAlerts() {
  const { host } = useCoforge();
  const store = useAlertsStore();
  const service = host.alerts;
  const prefix = useId();
  const ids = Object.fromEntries(['url', 'name', 'text', 'image', 'audio', 'video', 'duration', 'volume', 'event', 'automatic'].map(key => [key, `${prefix}-alert-${key}`]));
  let closed = false;
  let nameInput: HTMLInputElement | undefined;
  let newButton: HTMLButtonElement | undefined;
  let fireButton: HTMLButtonElement | undefined;
  let deleteButton: HTMLButtonElement | undefined;
  let confirmButton: HTMLButtonElement | undefined;
  let setupSummary: HTMLElement | undefined;
  let dispatchHeading: HTMLElement | undefined;
  const focus = (element: HTMLElement | undefined) => { if (!closed) element?.focus(); };

  function select(id: string) {
    store.selected = id; store.deleting = ''; store.error = ''; store.notice = '';
    const saved = store.state.templates.find(item => item.id === id);
    if (saved && !store.drafts[id]) store.drafts[id] = { ...saved };
    store.variables[id] ??= {};
    store.editors[id] ??= !saved;
  }
  function receive(state: AlertsSnapshot) {
    if (closed) return;
    store.state = state;
    if (state.sources > 0 && !store.seenSource) {
      const focused = setupSummary?.ownerDocument.activeElement;
      if (!focused || !setupSummary?.parentElement?.contains(focused)) store.setupOpen = false;
      store.seenSource = true;
    }
    if (!store.selected && state.templates[0]) select(state.templates[0].id);
  }
  if (service) receive(service.snapshot());
  const unsubscribe = service?.subscribe(receive);
  onBeforeUnmount(() => { closed = true; unsubscribe?.(); });

  const create = async () => {
    const id = `alert-${crypto.randomUUID()}`;
    store.drafts[id] = { id, name: '', text: '', image: '', audio: '', video: '', duration: 6, volume: 0.7, event: '', enabled: false };
    select(id); await nextTick(); focus(nameInput);
  };
  const draft = computed(() => store.drafts[store.selected]);
  const saved = computed(() => store.state.templates.find(item => item.id === store.selected));
  const dirty = (id: string) => Boolean(store.drafts[id]) && JSON.stringify(store.drafts[id]) !== JSON.stringify(store.state.templates.find(item => item.id === id));
  const changed = computed(() => dirty(store.selected));
  const keys = computed(() => alertVariables(draft.value?.text ?? ''));
  const variables = computed(() => store.variables[store.selected] ?? {});
  const preview = computed(() => {
    if (!draft.value) return '';
    try { return renderAlert(draft.value, Object.fromEntries(keys.value.map(key => [key, variables.value[key] ?? `{${key}}`]))).text; }
    catch { return draft.value.text; }
  });
  const selectedEvent = computed(() => ALERT_EVENT_DEFINITIONS.find(event => event.id === draft.value?.event));
  const automaticVariables = computed(() => alertEventVariables(draft.value?.event ?? ''));
  const twitchEventHelp = computed(() => TWITCH_ALERT_HELP[draft.value?.event ?? ''] ?? '');
  const automaticProblem = computed(() => {
    if (!draft.value?.enabled) return '';
    if (!draft.value.event) return 'Choose an event or turn off automatic dispatch.';
    const unsupported = keys.value.filter(key => !automaticVariables.value.includes(key));
    return unsupported.length ? `Automatic ${selectedEvent.value?.label ?? 'event'} alerts cannot supply: ${unsupported.join(', ')}. Change the text variables or choose another event.` : '';
  });
  const run = async (work: () => void | string | Promise<void | string>, notice = '') => {
    if (store.busy) return false;
    const action = ++store.action;
    let succeeded = false;
    store.busy = true; store.error = ''; store.notice = '';
    try { const result = await work(); succeeded = action === store.action; if (!closed && succeeded) store.notice = typeof result === 'string' ? result : notice; }
    catch (error) { if (!closed && action === store.action) store.error = error instanceof Error ? error.message : 'The alert could not be updated. Your draft is retained.'; }
    finally { store.busy = false; }
    return succeeded;
  };
  if (host.listVaultFiles) void host.listVaultFiles().then(files => { if (!closed) store.files = files.filter(path => alertMediaType(path)); }).catch(() => { if (!closed) store.error = 'Media file list could not be loaded. Enter an existing vault-relative path or reopen Alerts.'; });
  const showSetup = async () => { store.setupOpen = true; await nextTick(); focus(setupSummary); setupSummary?.scrollIntoView({ block: 'nearest' }); };
  return reactive({
    store, ids, draft, saved, changed, keys, variables, preview, selectedEvent, automaticVariables, automaticProblem, twitchEventHelp,
    select, create, dirty, showSetup, events: ALERT_EVENT_DEFINITIONS,
    editorOpen: computed(() => store.editors[store.selected] ?? !saved.value),
    mediaIds: { image: `${prefix}-alert-images`, audio: `${prefix}-alert-audio`, video: `${prefix}-alert-video` },
    imageFiles: computed(() => store.files.filter(path => alertMediaType(path)?.startsWith('image/'))),
    audioFiles: computed(() => store.files.filter(path => alertMediaType(path)?.startsWith('audio/'))),
    videoFiles: computed(() => store.files.filter(path => alertMediaType(path)?.startsWith('video/'))),
    available: computed(() => Boolean(service && store.state.ready)),
    connectionLabel: computed(() => !store.state.ready ? 'Alerts source unavailable' : store.state.sources === 0 ? 'No browser source connected' : `${store.state.sources} browser source${store.state.sources === 1 ? '' : 's'} connected`),
    unsaved: computed(() => Object.values(store.drafts).filter(item => !store.state.templates.some(saved => saved.id === item.id))),
    save: async () => {
      const succeeded = await run(async () => {
      if (automaticProblem.value) throw new Error(automaticProblem.value);
      if (!draft.value || !service) return;
      const id = store.selected;
      await service.save({ ...draft.value });
      const normalized = service.snapshot().templates.find(item => item.id === id);
      if (normalized) store.drafts[id] = { ...normalized };
      store.editors[id] = false;
      }, 'Alert saved. It is ready to fire.');
      if (succeeded) { await nextTick(); focus(fireButton?.disabled ? dispatchHeading : fireButton); }
    },
    fire: () => run(async () => {
      if (!service) return;
      const result = await service.fire(store.selected, { ...variables.value });
      return `Sent to ${result.sources} connected browser source${result.sources === 1 ? '' : 's'}. Check OBS for playback and audio.`;
    }),
    clear: () => {
      store.action++; store.error = '';
      try { service?.clear(); store.notice = 'Playback and queued alerts cleared. Enabled automatic bindings remain active.'; }
      catch { store.error = 'Alerts could not be cleared. Check the source and retry Stop all alerts.'; }
    },
    copy: () => run(async () => {
      try { await navigator.clipboard.writeText(store.state.url); }
      catch { throw new Error('Automatic copying is unavailable. Select the Alerts URL field and copy it with your keyboard.'); }
    }, 'Alerts URL copied. Paste it into an OBS Browser Source.'),
    remove: async () => {
      const succeeded = await run(async () => {
      const id = store.selected;
      if (service && saved.value) await service.remove(id);
      delete store.drafts[id]; delete store.variables[id]; delete store.editors[id]; store.selected = ''; store.deleting = '';
      const next = store.state.templates[0]; if (next) select(next.id);
      }, 'Alert removed.');
      if (succeeded) { await nextTick(); focus(newButton); }
    },
    discard: async () => {
      const id = store.selected; delete store.drafts[id];
      if (saved.value) { select(id); store.editors[id] = false; await nextTick(); focus(fireButton?.disabled ? dispatchHeading : fireButton); }
      else { delete store.editors[id]; store.selected = ''; store.deleting = ''; await nextTick(); focus(newButton); }
    },
    markDelete: async () => { store.deleting = store.selected; await nextTick(); focus(confirmButton); },
    cancelDelete: async () => { store.deleting = ''; await nextTick(); focus(deleteButton); },
    selectUrl: (event: Event) => { if (elementTag(event.target, 'input')) event.target.select(); },
    toggleSetup: (event: Event) => { if (elementTag(event.target, 'details')) store.setupOpen = event.target.open; },
    toggleEditor: (event: Event) => { if (elementTag(event.target, 'details')) store.editors[store.selected] = event.target.open; },
    changeEvent: (event: Event) => {
      if (!draft.value || !elementTag(event.target, 'select')) return;
      const value = event.target.value;
      draft.value.event = ALERT_EVENT_DEFINITIONS.find(item => item.id === value)?.id ?? '';
      if (!draft.value.event) draft.value.enabled = false;
    },
    updateText: (field: 'name' | 'text' | 'image' | 'audio' | 'video', event: Event) => {
      if (draft.value && (elementTag(event.target, 'input') || elementTag(event.target, 'textarea'))) draft.value[field] = event.target.value;
    },
    updateNumber: (field: 'duration' | 'volume', event: Event) => {
      if (draft.value && elementTag(event.target, 'input')) draft.value[field] = event.target.valueAsNumber;
    },
    enableAutomatic: (event: Event) => { if (draft.value && elementTag(event.target, 'input')) draft.value.enabled = event.target.checked; },
    setVariable: (key: string, event: Event) => { if (elementTag(event.target, 'input')) { store.variables[store.selected] ??= {}; store.variables[store.selected]![key] = event.target.value; } },
    eventLabel: (template: AlertTemplate) => template.enabled && template.event ? `Automatic: ${ALERT_EVENT_DEFINITIONS.find(event => event.id === template.event)?.label ?? template.event}` : 'Manual only',
    bindName: (element: unknown) => { nameInput = elementTag(element, 'input') ? element : undefined; },
    bindNew: (element: unknown) => { newButton = elementTag(element, 'button') ? element : undefined; },
    bindFire: (element: unknown) => { fireButton = elementTag(element, 'button') ? element : undefined; },
    bindDelete: (element: unknown) => { deleteButton = elementTag(element, 'button') ? element : undefined; },
    bindConfirm: (element: unknown) => { confirmButton = elementTag(element, 'button') ? element : undefined; },
    bindSetup: (element: unknown) => { setupSummary = htmlElement(element) ? element : undefined; },
    bindDispatch: (element: unknown) => { dispatchHeading = htmlElement(element) ? element : undefined; },
  });
}
