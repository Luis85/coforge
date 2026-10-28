import { computed, onMounted, onUnmounted } from "vue";
import type { CouncilActions } from "../../../features/coforge/application/council-ports";
import { useCouncilMessageStore } from "../../stores/coforge-council-messages";

export type CouncilMessagingActions = Pick<
  CouncilActions,
  | "messages"
  | "postInformation"
  | "flushMessages"
  | "stopConversation"
  | "subscribe"
>;
export function useCouncilMessages(props: {
  actions: CouncilMessagingActions;
  teamId: string;
}) {
  const store = useCouncilMessageStore();
  const messages = computed(() =>
    store.entries.filter((item) => item.message.teamId === props.teamId),
  );
  let unsubscribe: (() => void) | undefined;
  function refresh(): void {
    store.entries = props.actions.messages();
  }
  async function action(work: () => Promise<void>): Promise<void> {
    if (store.busy) return;
    store.busy = true;
    store.error = "";
    store.notice = "";
    try {
      await work();
      refresh();
    } catch (error) {
      store.error =
        error instanceof Error
          ? error.message
          : "The message action failed. Inspect its delivery state and retry.";
    } finally {
      store.busy = false;
    }
  }
  const post = () =>
    action(async () => {
      const draft = store.draft;
      if (!props.teamId || !draft.trim())
        throw new Error("Select a team and enter information before posting.");
      await props.actions.postInformation(props.teamId, draft);
      if (store.draft === draft) store.draft = "";
      store.notice =
        "Team information was saved. It becomes context for later runs and starts no tasks.";
    });
  const repair = () => action(() => props.actions.flushMessages());
  const stop = (rootId: string) =>
    action(async () => {
      await props.actions.stopConversation(rootId);
      store.notice = "Future dispatch for this root conversation is stopped.";
    });
  onMounted(() => {
    refresh();
    unsubscribe = props.actions.subscribe(refresh);
  });
  onUnmounted(() => unsubscribe?.());
  return { store, messages, post, repair, stop, refresh };
}
