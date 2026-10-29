import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { useTwitchOperationsSection } from './use-twitch-operations';

const ADS_FRESH_FOR = 60_000;
const RAID_FRESH_FOR = 30_000;

function timestamp(value: unknown): number | null {
  if (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) {
    const seconds = Number(value); return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
  }
  if (typeof value !== 'string' || !value) return null;
  const result = Date.parse(value); return Number.isFinite(result) ? result : null;
}
function nonnegative(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const result = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(result) && result >= 0 ? result : null;
}
function countdown(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

/** A local clock updates known timing only; it never starts an ad or a raid. */
export function useTwitchBroadcast() {
  const model = useTwitchOperationsSection();
  const { host } = useCoforge();
  const studio = useStudioStore();
  const now = ref(Date.now());
  const clock = window.setInterval(() => { now.value = Date.now(); }, 1000);
  let sequence = 0;
  onBeforeUnmount(() => { sequence++; window.clearInterval(clock); });
  const adSnapshot = computed(() => model.snapshot.resources.ads);
  const adAuthorized = computed(() => model.snapshot.capabilities.find(capability => capability.resource === 'ads')?.available === true);
  const adRecord = computed(() => adSnapshot.value?.result?.records[0]);
  const adAge = computed(() => {
    const checked = timestamp(adSnapshot.value?.checkedAt);
    return checked === null ? null : now.value - checked;
  });
  const currentAds = computed(() => adAuthorized.value && adSnapshot.value?.status === 'ready' && Boolean(adRecord.value) && adAge.value !== null && adAge.value >= 0 && adAge.value <= ADS_FRESH_FOR);
  const nextAd = computed(() => timestamp(adRecord.value?.next_ad_at));
  const snoozes = computed(() => currentAds.value ? nonnegative(adRecord.value?.snooze_count) : null);
  const preRollSeconds = computed(() => {
    const observed = nonnegative(adRecord.value?.preroll_free_time);
    return currentAds.value && observed !== null ? Math.max(0, observed - (adAge.value ?? 0) / 1000) : null;
  });
  const adStatus = computed(() => {
    if (!adAuthorized.value) return 'Authorize ad schedule data access below to inspect break timing.';
    if (adSnapshot.value?.status === 'loading') return 'Refreshing ad schedule…';
    if (adSnapshot.value?.status === 'unavailable') return 'Ad schedule unavailable. Refresh or authorize data access below.';
    if (!adSnapshot.value?.checkedAt || !adRecord.value) return 'Refresh ad data below to see the next break and available snoozes.';
    if (!currentAds.value) return 'Schedule is stale. Refresh ad data before planning a break.';
    if (nextAd.value !== null && nextAd.value <= now.value) return 'Scheduled ad time reached. Refresh Twitch status.';
    return 'Ad schedule is current. Twitch controls eligibility and cooldowns.';
  });
  const context = computed(() => JSON.stringify([model.connection.twitchClientId, model.connection.twitchBroadcasterId, studio.state?.runtime.twitch?.streamer?.id ?? '']));
  const targetId = computed({
    get: () => String(model.store.drafts['raid-start']?.to_broadcaster_id ?? ''),
    set: (value: string) => {
      if (!model.store.drafts['raid-start']) model.store.drafts['raid-start'] = {};
      model.store.drafts['raid-start']!.to_broadcaster_id = value;
      model.store.review = null;
    },
  });
  const shortlist = computed(() => model.snapshot.templates?.filter(template => template.action.name === 'raid-start' && typeof template.action.parameters.to_broadcaster_id === 'string') ?? []);
  const selectedTemplate = ref('');
  const previewBusy = ref(false);
  const previewError = ref('');
  const targetAge = computed(() => {
    const checked = timestamp(model.store.raidTarget?.checkedAt);
    return checked === null ? null : now.value - checked;
  });
  const raidTarget = computed(() => model.store.raidPreviewContext === context.value && model.store.raidTarget?.id === targetId.value.trim() && targetAge.value !== null && targetAge.value >= 0 && targetAge.value <= RAID_FRESH_FOR ? model.store.raidTarget : null);
  watch([targetId, context], () => {
    sequence++; model.store.raidTarget = null; model.store.raidPreviewContext = ''; previewError.value = ''; previewBusy.value = false;
  }, { flush: 'sync' });
  function selectShortlist() {
    const template = shortlist.value.find(item => item.id === selectedTemplate.value);
    if (template) targetId.value = String(template.action.parameters.to_broadcaster_id);
  }
  async function previewRaid() {
    const read = host.twitchOperations?.previewRaid;
    const id = targetId.value.trim();
    if (!read || previewBusy.value) return;
    if (!/^\d+$/.test(id)) { previewError.value = 'Enter a numeric Twitch channel ID, or choose a saved raid template.'; return; }
    if (id === model.connection.twitchBroadcasterId) { previewError.value = 'Choose another broadcaster for the raid.'; return; }
    const captured = context.value; const request = ++sequence;
    previewBusy.value = true; previewError.value = ''; model.store.raidTarget = null;
    try {
      const target = await read(id);
      if (request !== sequence || captured !== context.value || targetId.value.trim() !== id) return;
      if (target.id !== id) throw new Error('Twitch returned another channel. Preview the intended target again.');
      model.store.raidTarget = target; model.store.raidPreviewContext = captured; now.value = Date.now();
    } catch (problem) { if (request === sequence) previewError.value = problem instanceof Error ? problem.message : 'The raid target could not be verified. Try previewing again.'; }
    finally { if (request === sequence) previewBusy.value = false; }
  }
  function prepareRaid() {
    if (!raidTarget.value?.isLive) return;
    model.setAction('raid-start');
    model.store.notice = 'Raid target added to the action draft below. Review and confirm before Twitch starts the countdown.';
  }
  function prepareSnooze() { if (currentAds.value && snoozes.value !== null && snoozes.value > 0) model.setAction('ad-snooze'); }
  return reactive({ model, targetId, shortlist, selectedTemplate, selectShortlist, previewBusy, previewError, previewRaid, raidTarget, prepareRaid, prepareSnooze,
    canPreview: Boolean(host.twitchOperations?.previewRaid), adStatus, currentAds, snoozes,
    adCountdown: computed(() => !currentAds.value ? 'Unavailable' : nextAd.value === null ? 'None scheduled' : nextAd.value <= now.value ? 'Refresh status' : countdown((nextAd.value - now.value) / 1000)),
    preRollCountdown: computed(() => preRollSeconds.value === null ? 'Unavailable' : countdown(preRollSeconds.value)),
    adObserved: computed(() => adSnapshot.value?.checkedAt ? model.time(adSnapshot.value.checkedAt) : 'Not collected'),
    canSnooze: computed(() => currentAds.value && snoozes.value !== null && snoozes.value > 0 && !model.store.busy),
    expiredTarget: computed(() => Boolean(model.store.raidTarget && !raidTarget.value)),
    targetUrl: computed(() => raidTarget.value ? `https://www.twitch.tv/${encodeURIComponent(raidTarget.value.login)}` : ''),
  });
}
