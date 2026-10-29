import { computed, reactive, ref } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { OPERATION_CODES } from "../../../features/coforge/domain/population";

export function useOperations() {
  const { host } = useCoforge();
  const store = useStudioStore();
  const code = ref("");
  const effect = ref("");
  const error = ref("");
  const notice = ref("");
  const working = ref(false);
  const counters = computed(() => store.state?.population?.counters ?? {});
  const names = computed(() => new Map(store.state?.contributors.map((person) => [person.id, person.name])));
  async function run(work: () => Promise<unknown>, success: string) {
    error.value = "";
    notice.value = "";
    working.value = true;
    try {
      await store.mutate(work);
      notice.value = success;
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : "The operation could not be completed.";
    } finally {
      working.value = false;
    }
  }
  return reactive({
    store,
    code,
    effect,
    error,
    notice,
    working,
    unconfirmedCount: computed(() => (store.state?.population?.operations ?? []).filter(record => record.effect === "uncertain").length),
    showUnconfirmed: () => { code.value = ""; effect.value = "uncertain"; },
    clearFilters: () => { code.value = ''; effect.value = ''; },
    filtered: computed(() => Boolean(code.value || effect.value)),
    canExport: Boolean(host.exportDiagnostics),
    codes: OPERATION_CODES.map((code) => ({ id: code, label: code.replaceAll("-", " ") })),
    groups: computed(() => [
      {
        title: "Participation",
        stats: [
          { label: "Registrations", value: counters.value.registered ?? 0 },
          { label: "Feature requests", value: counters.value["request-created"] ?? 0 },
          { label: "Bug reports", value: counters.value["bug-created"] ?? 0 },
          { label: "Votes counted", value: counters.value["vote-counted"] ?? 0 },
          { label: "Messages observed", value: counters.value["message-observed"] ?? 0 },
          { label: "Commands rejected", value: counters.value["command-rejected"] ?? 0 },
          { label: "Cooldown rejections", value: counters.value["cooldown-rejected"] ?? 0 },
        ],
      },
      {
        title: "Bot and moderation",
        stats: [
          { label: "Messages confirmed", value: counters.value["reply-confirmed"] ?? 0 },
          {
            label: "Failed / unconfirmed",
            value: (counters.value["reply-failed"] ?? 0) + (counters.value["reply-uncertain"] ?? 0),
          },
          { label: "Recurring occurrences skipped", value: counters.value["broadcast-skipped"] ?? 0 },
          { label: "Moderation confirmed", value: counters.value["moderation-confirmed"] ?? 0 },
          { label: "Presence checks failed", value: counters.value["presence-failed"] ?? 0 },
        ],
      },
      {
        title: "AI workflow",
        stats: [
          { label: "Jobs completed", value: counters.value["job-completed"] ?? 0 },
          { label: "Jobs failed", value: counters.value["job-failed"] ?? 0 },
          { label: "Jobs cancelled", value: counters.value["job-cancelled"] ?? 0 },
        ],
      },
    ]),
    records: computed(() =>
      [...(store.state?.population?.operations ?? [])]
        .reverse()
        .filter(
          (record) => (!code.value || record.code === code.value) && (!effect.value || record.effect === effect.value),
        )
        .map((record) => ({
          ...record,
          label: record.code.replaceAll("-", " "),
          effectLabel:
            record.effect === "none" ? "No change" : record.effect === "uncertain" ? "Unconfirmed" : "Committed",
          time: new Date(record.at).toLocaleString(),
          player: record.playerId ? (names.value.get(record.playerId) ?? record.playerId) : "—",
        })),
    ),
    retention: computed(
      () =>
        `${store.state?.population?.operations.length ?? 0} records retained; ${store.state?.population?.droppedOperations ?? 0} older records omitted. Counters are cumulative since this foundation was enabled.`,
    ),
    rewardRetention: computed(
      () =>
        `${store.state?.population?.rewards.length ?? 0} reward entries retained; ${store.state?.population?.droppedRewards ?? 0} older entries omitted. Balances and reward claims are retained.`,
    ),
    exportDiagnostics: () => {
      void run(async () => {
          if (!host.exportDiagnostics) throw new Error("Safe diagnostic export is available in Obsidian.");
          await host.exportDiagnostics();
      }, "Safe diagnostics saved in the plugin configuration folder.");
    },
  });
}
