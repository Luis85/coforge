import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TwitchActionName, TwitchActionPreview, TwitchResource, TwitchRaidTarget } from '../../features/coforge/domain/twitch-operations';
import type { ScheduleNote } from '../../features/coforge/domain/schedule';
import type { StreamSummary } from '../../features/coforge/domain/stream-metrics';

export const TWITCH_OPERATION_PAGES = [
  { id: 'activity', label: 'Activity', resources: ['activity', 'hype-train'] },
  { id: 'moderation', label: 'Moderation', resources: ['chat-settings', 'automod-settings', 'automod-queue', 'blocked-terms', 'unban-requests', 'shield'] },
  { id: 'engagement', label: 'Engagement', resources: ['rewards', 'redemptions', 'polls', 'predictions'] },
  { id: 'broadcast', label: 'Breaks & raids', resources: ['ads', 'activity'] },
  { id: 'channel', label: 'Audience', resources: ['followers', 'subscribers', 'bits', 'moderators', 'vips', 'goals', 'charity'] },
  { id: 'content', label: 'Content', resources: ['clips', 'markers', 'videos'] },
  { id: 'schedule', label: 'Schedule', resources: ['schedule'] },
  { id: 'data', label: 'Data & access', resources: [] },
] as const;
export type TwitchOperationPage = typeof TWITCH_OPERATION_PAGES[number]['id'];

/** Drafts belong to this view's Pinia instance and survive ordinary studio navigation. */
export const useTwitchOperationsStore = defineStore('coforge-twitch-operations', () => {
  const page = ref<TwitchOperationPage>('activity');
  const resource = ref<TwitchResource>('activity');
  const action = ref<TwitchActionName>('announcement');
  const drafts = ref<Record<string, Record<string, string | number>>>({});
  const review = ref<TwitchActionPreview | null>(null);
  const query = ref({ reward_id: '', status: 'UNFULFILLED', after: '' });
  const activityFilter = ref('');
  const username = ref('');
  const recoveryNotes = ref<Record<string, string>>({});
  const retentionDays = ref(30);
  const localPlans = ref<ScheduleNote[]>([]);
  const selectedPlan = ref('');
  const templateName = ref('');
  const templateId = ref('');
  const activityLinks = ref<Record<string, string>>({});
  const report = ref('');
  const streams = ref<StreamSummary[]>([]);
  const reportStream = ref('');
  const raidTarget = ref<TwitchRaidTarget | null>(null);
  const raidPreviewContext = ref('');
  const error = ref('');
  const notice = ref('');
  const busy = ref(false);
  return { page, resource, action, drafts, review, query, activityFilter, username, recoveryNotes, retentionDays, localPlans, selectedPlan, templateName, templateId, activityLinks, report, streams, reportStream, raidTarget, raidPreviewContext, error, notice, busy };
});
