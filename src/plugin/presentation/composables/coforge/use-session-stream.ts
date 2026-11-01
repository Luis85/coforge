import { nextTick, onBeforeUnmount, reactive, ref, watch, type ComponentPublicInstance } from 'vue';
import type { SessionEventView } from './agent-session-display';

/** Follow only this mounted, selected feed. User scrolling never gets pulled back by new observations. */
export function useSessionStream(props: { entries: SessionEventView[]; selectionKey: string }) {
  let element: HTMLElement | null = null;
  let generation = 0;
  let previousSequence = 0;
  let frame: number | undefined;
  let frameOwner: Window | undefined;
  let settling = false;
  let stableFrames = 0;
  let settlingFrames = 0;
  const following = ref(true);
  const unread = ref(0);
  function cancelFrame() { if (frame !== undefined) frameOwner?.cancelAnimationFrame(frame); frame = undefined; }
  function settle() {
    if (frame !== undefined || !element || !following.value || !settling) return;
    frameOwner = element.ownerDocument.defaultView ?? undefined;
    if (!frameOwner) { settling = false; return; }
    frame = frameOwner.requestAnimationFrame(() => {
      frame = undefined;
      if (!element || !following.value || !settling) return;
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      settlingFrames++;
      if (remaining <= 1) stableFrames++; else { stableFrames = 0; element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }); }
      if (stableFrames >= 2 || settlingFrames >= 60) { settling = false; return; }
      settle();
    });
  }
  async function end() {
    const current = generation; settling = true; stableFrames = 0; settlingFrames = 0;
    await nextTick();
    if (current === generation && element && following.value) { element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }); settle(); }
  }
  watch(() => props.selectionKey, () => { generation++; cancelFrame(); following.value = true; unread.value = 0; previousSequence = props.entries.at(-1)?.sequence ?? 0; void end(); }, { immediate: true });
  watch(() => JSON.stringify(props.entries), () => {
    const newEntries = props.entries.filter(entry => entry.sequence > previousSequence).length;
    previousSequence = props.entries.at(-1)?.sequence ?? previousSequence;
    if (following.value) { unread.value = 0; void end(); }
    else if (newEntries) unread.value += newEntries;
  });
  onBeforeUnmount(() => { generation++; cancelFrame(); element = null; });
  function pause() { generation++; settling = false; cancelFrame(); following.value = false; }
  function resume() { generation++; cancelFrame(); following.value = true; unread.value = 0; void end(); }
  return reactive({ following, unread,
    bind: (value: Element | ComponentPublicInstance | null) => { element = value instanceof HTMLElement ? value : null; },
    scrolled: () => {
      if (!element) return;
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      if (settling && following.value) { if (remaining > 1) { stableFrames = 0; element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }); } settle(); return; }
      if (!following.value) return;
      if (remaining > 24) pause(); else unread.value = 0;
    },
    wheel: (event: WheelEvent) => { if (event.deltaY < 0) pause(); },
    pointer: pause,
    keydown: (event: KeyboardEvent) => {
      if (!element || event.target !== element || event.ctrlKey || event.metaKey || event.altKey) return;
      const page = Math.max(40, element.clientHeight - 40);
      const offsets: Record<string, number> = { Home: -element.scrollHeight, End: element.scrollHeight, PageUp: -page, PageDown: page, ArrowUp: -40, ArrowDown: 40, ' ': event.shiftKey ? -page : page };
      const offset = offsets[event.key]; if (offset === undefined) return;
      event.preventDefault(); if (offset < 0) pause();
      element.scrollTo({ top: Math.max(0, element.scrollTop + offset), behavior: 'instant' });
      if (element.scrollHeight - element.clientHeight - element.scrollTop <= 1 && offset > 0) resume();
    },
    pause, resume, toggle: () => { if (following.value) pause(); else resume(); },
  });
}
