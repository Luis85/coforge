import { nextTick, onMounted, watch, type ComponentPublicInstance } from 'vue';

/**
 * Keeps a scrolling message log pinned to its newest entry. The log follows new messages only while
 * the reader is near the bottom, so scrolling up to read history is never interrupted. Bind `bind` as
 * a function template ref and `onScroll` to the element's scroll event.
 */
export function useChatAutoScroll(newest: () => string, threshold = 80) {
  let list: HTMLElement | null = null;
  let nearBottom = true;
  const toBottom = () => { if (list && nearBottom) list.scrollTop = list.scrollHeight; };
  watch(newest, () => { void nextTick(toBottom); });
  onMounted(toBottom);
  return {
    bind: (element: Element | ComponentPublicInstance | null) => { list = element instanceof HTMLElement ? element : null; },
    onScroll: () => { if (list) nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < threshold; },
    /** Follows the log again, e.g. after the streamer sent a message. */
    stick: () => { nearBottom = true; void nextTick(toBottom); },
  };
}
