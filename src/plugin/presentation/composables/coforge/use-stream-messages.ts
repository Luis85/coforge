import { computed, reactive, ref } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";

export function useStreamMessages() {
  const { studio } = useCoforge();
  const store = useStudioStore();
  const editing = ref<string | undefined>();
  const text = ref("");
  const interval = ref(5);
  const working = ref(false);
  const error = ref("");
  const notice = ref("");
  const deleting = ref("");
  async function run(work: () => Promise<unknown>, success: string): Promise<boolean> {
    error.value = "";
    notice.value = "";
    working.value = true;
    try {
      await store.mutate(work);
      notice.value = success;
      return true;
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : "The stream message could not be updated.";
      return false;
    } finally {
      working.value = false;
    }
  }
  const reset = () => {
    editing.value = undefined;
    text.value = "";
    interval.value = 5;
  };
  async function save() {
    if (
      await run(
        () => studio.saveStreamMessage({ text: text.value, intervalMinutes: interval.value }, editing.value),
        "Message saved paused. Activate it when ready.",
      )
    )
      reset();
  }
  return reactive({
    store,
    editing,
    text,
    interval,
    working,
    error,
    notice,
    deleting,
    rows: computed(() =>
      (store.state?.streamMessages ?? []).map((message) => {
        const integration = studio.integration();
        const live = store.state?.runtime.twitch?.tracking?.streamId;
        const pending = store.state?.botReplies?.find(
          (reply) => reply.streamMessageId === message.id && ["pending", "sending"].includes(reply.status),
        );
        return {
          ...message,
          status: !message.active
            ? "Paused"
            : message.channelId !== integration.twitchBroadcasterId
              ? "Other channel"
              : !integration.twitchBotReplies
                ? "Waiting for automatic bot messages"
                : !live
                  ? "Waiting for live stream"
                  : pending
                    ? pending.status === "sending"
                      ? "Sending"
                      : "Queued"
                    : "Active",
          next: message.nextDueAt ? new Date(message.nextDueAt).toLocaleTimeString() : "After the next live interval",
          sent: message.lastSentAt ? new Date(message.lastSentAt).toLocaleString() : "Not confirmed yet",
        };
      }),
    ),
    enabled: computed(() => {
      void store.state;
      return studio.integration().twitchBotReplies;
    }),
    save: (event: Event) => {
      event.preventDefault();
      void save();
    },
    reset,
    edit: (id: string) => {
      const message = store.state?.streamMessages?.find((message) => message.id === id);
      if (message) {
        editing.value = id;
        text.value = message.text;
        interval.value = message.intervalMinutes;
        error.value = "";
      }
    },
    activate: (id: string, active: boolean) => {
      void run(
        () => studio.activateStreamMessage(id, active),
        active
          ? "Message activated. It waits for a live stream and its full interval."
          : "Message paused. Unsent queued copies are cancelled; an in-flight send may still finish.",
      );
    },
    remove: () => {
      const id = deleting.value;
      if (id)
        void run(async () => {
          await studio.removeStreamMessage(id);
          deleting.value = "";
          if (editing.value === id) reset();
        }, "Stream message deleted.");
    },
  });
}
