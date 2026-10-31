import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
import { relativeTime } from "./format";
import { ideaProjectId } from "../../../features/coforge/domain/projects";

const focusable = (value: unknown): value is HTMLElement =>
  Boolean(
    value &&
    typeof value === "object" &&
    Reflect.get(value, "nodeType") === 1 &&
    typeof Reflect.get(value, "focus") === "function",
  );
export function useActivityPopover() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const now = ref(Date.now());
  let opener: HTMLElement | undefined;
  let root: HTMLElement | undefined;
  let timer: number | undefined;
  let timerWindow: Window | undefined;
  const close = () => {
    store.activityOpen = false;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  onMounted(() => {
    const active = root?.ownerDocument.activeElement;
    opener = focusable(active) ? active : undefined;
    timerWindow = root?.ownerDocument.defaultView ?? window;
    void nextTick(() =>
      root
        ?.querySelector<HTMLButtonElement>('[aria-label="Close activity"]')
        ?.focus({ preventScroll: true }),
    );
    timer = timerWindow.setInterval(() => {
      now.value = Date.now();
    }, 60000);
  });
  onBeforeUnmount(() => {
    if (timer !== undefined) timerWindow?.clearInterval(timer);
    root = undefined;
  });
  async function open(ideaId?: string) {
    if (!ideaId || !store.state?.ideas.some((idea) => idea.id === ideaId))
      return;
    if (await actions.openIdea(ideaId)) store.activityOpen = false;
  }
  return reactive({
    close,
    bind: (value: unknown) => {
      root = focusable(value) ? value : undefined;
    },
    keydown: (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    events: computed(() =>
      [...(store.state?.events ?? [])]
        .reverse()
        .slice(0, 30)
        .map((event) => {
          const idea = event.ideaId
            ? store.state?.ideas.find((item) => item.id === event.ideaId)
            : undefined;
          const project = idea
            ? store.state?.projects?.find(
                (item) => item.id === ideaProjectId(idea),
              )
            : undefined;
          const absolute = new Date(event.createdAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          });
          return {
            ...event,
            targetId: idea?.id,
            scope: project?.settings.projectName,
            when: relativeTime(event.createdAt, now.value),
            absolute,
          };
        }),
    ),
    link: (ideaId?: string) =>
      ideaId
        ? {
            type: "button",
            onClick: () => {
              void open(ideaId);
            },
          }
        : {},
  });
}
