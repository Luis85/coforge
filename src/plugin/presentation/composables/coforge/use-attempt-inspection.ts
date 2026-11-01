import { nextTick, onBeforeUnmount, watch, type ComponentPublicInstance } from 'vue';
import { useStudioStore } from '../../stores/coforge-studio';

/** Focus the exact retained disclosure after readonly cross-tab navigation, with no selectors built from IDs. */
export function useAttemptInspection() {
  const store = useStudioStore(); const elements = new Set<HTMLElement>(); let generation = 0;
  watch(() => [store.inspectedJob, store.selected, store.state?.activeProjectId], async () => {
    const token = ++generation; const target = store.inspectedJob;
    if (!target) return;
    await nextTick();
    if (token !== generation) return;
    const element = [...elements].find(element => element.isConnected && element.dataset.jobId === target.id);
    if (!element) return;
    if (element.tagName === 'DETAILS') element.setAttribute('open', '');
    const section = [...element.querySelectorAll<HTMLElement>('[data-attempt-section]')].find(section => section.dataset.attemptSection === target.section);
    const focus = section?.querySelector<HTMLElement>('h4,h3,summary,button') ?? element.querySelector<HTMLElement>('summary');
    if (focus) { focus.tabIndex = -1; focus.focus(); focus.scrollIntoView?.({ block: 'nearest' }); }
  }, { immediate: true, flush: 'post' });
  onBeforeUnmount(() => { generation++; elements.clear(); });
  return { bind: (value: Element | ComponentPublicInstance | null) => { if (value instanceof HTMLElement) elements.add(value); } };
}
