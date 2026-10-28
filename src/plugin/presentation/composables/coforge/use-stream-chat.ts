import { nextTick, onBeforeUnmount, watch } from "vue";
import type { StreamSurfaceSnapshot } from "../../../features/coforge/domain/stream-surfaces";
/** Capture chat follows the latest public messages; native popouts and main tabs use their own DOM owner. */
export function useStreamChat(props: { chat: StreamSurfaceSnapshot["chat"] }) {
  let viewport: HTMLElement | undefined;
  let closed = false;
  const bind = (value: unknown) => {
    if (chatViewport(value)) viewport = value;
  };
  const tail = async () => {
    await nextTick();
    if (!closed && viewport) viewport.scrollTop = viewport.scrollHeight;
  };
  watch(
    () => props.chat.messages,
    () => {
      void tail();
    },
    { immediate: true, flush: "post" },
  );
  onBeforeUnmount(() => {
    closed = true;
    viewport = undefined;
  });
  return {
    bind,
    time: (at: string) =>
      Number.isFinite(Date.parse(at))
        ? new Date(at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
  };
}
function chatViewport(value: unknown): value is HTMLElement {
  return Boolean(
    value &&
    typeof value === "object" &&
    Reflect.get(value, "nodeType") === 1 &&
    typeof Reflect.get(value, "scrollTo") === "function",
  );
}
