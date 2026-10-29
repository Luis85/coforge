import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AlertsSnapshot, AlertTemplate } from '../../features/coforge/domain/alerts';
export const useAlertsStore = defineStore('coforge-alerts', () => {
  const state = ref<AlertsSnapshot>({ version: 1, templates: [], ready: false, url: '', error: '', sources: 0 });
  const selected = ref('');
  const drafts = ref<Record<string, AlertTemplate>>({});
  const variables = ref<Record<string, Record<string, string>>>({});
  const files = ref<string[]>([]);
  const setupOpen = ref(true);
  const seenSource = ref(false);
  const editors = ref<Record<string, boolean>>({});
  const action = ref(0);
  const error = ref(''); const notice = ref(''); const busy = ref(false); const deleting = ref('');
  return { state, selected, drafts, variables, files, setupOpen, seenSource, editors, action, error, notice, busy, deleting };
});
