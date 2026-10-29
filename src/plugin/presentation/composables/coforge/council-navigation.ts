import { computed, nextTick, reactive, shallowRef, watch, type ComponentPublicInstance } from 'vue';
import type { useCouncilStore } from '../../stores/coforge-council';
import { COUNCIL_PAGES, type CouncilPage } from '../../stores/studio-pages';

export const COUNCIL_TASKS = [
  { id: 'ask', label: 'Ask', pages: ['ask', 'submit'] },
  { id: 'activity', label: 'Activity', pages: ['monitor', 'messages'] },
  { id: 'setup', label: 'Setup', pages: ['definitions', 'folders'] },
  { id: 'automation', label: 'Automation', pages: ['inboxes', 'scheduler', 'events', 'workflows'] },
] as const;
export type CouncilTask = typeof COUNCIL_TASKS[number]['id'];

export function useCouncilNavigation(store: ReturnType<typeof useCouncilStore>, projectId: () => string | undefined) {
  const target = shallowRef<HTMLElement | null>(null);
  const family = computed(() => COUNCIL_TASKS.find(task => task.pages.some(page => page === store.tab)) ?? COUNCIL_TASKS[0]);
  watch(projectId, (id, previous) => {
    if (!store.runScopeInitialized || store.projectFilter === (previous ?? '')) {
      if (store.runScopeInitialized || !store.projectFilter) store.projectFilter = id ?? '';
      store.runScopeInitialized = true;
    }
  }, { immediate: true });
  watch(() => store.tab, page => {
    store.familyPages[family.value.id] = page;
    void nextTick(() => target.value?.querySelector('nav[aria-label="Council workspace"] [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }, { immediate: true });
  return reactive({
    bindNavigation: (value: Element | ComponentPublicInstance | null) => { target.value = value instanceof HTMLElement ? value : null; },
    revealFocus: (event: FocusEvent) => { if (event.target instanceof HTMLElement) event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); },
    tasks: COUNCIL_TASKS,
    selected: computed(() => family.value.id),
    pages: computed(() => COUNCIL_PAGES.filter(page => family.value.pages.some(id => id === page.id))),
    pageForFamily: (id: CouncilTask): CouncilPage => {
      const task = COUNCIL_TASKS.find(task => task.id === id) ?? COUNCIL_TASKS[0];
      const remembered = store.familyPages[id];
      return task.pages.some(page => page === remembered) ? remembered : task.pages[0];
    },
  });
}
