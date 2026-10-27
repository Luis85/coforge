import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { defaultCommunityEnvironment } from "../../../features/coforge/domain/community-environment";
import { defaultEconomyRules } from "../../../features/coforge/domain/population";

export function useCommunitySettings() {
  const { studio } = useCoforge();
  const form = useTemplateRef<HTMLFormElement>('communitySettingsForm');
  const store = useStudioStore();
  const environment = reactive(defaultCommunityEnvironment());
  const rules = reactive(defaultEconomyRules());
  const loaded = ref(false);
  const error = ref("");
  const notice = ref("");
  const working = ref(false);
  const saved = ref("");
  const encoded = computed(() => JSON.stringify({ environment, rules }));
  watch([encoded, saved], () => {
    store.dirtyCommunitySettings = encoded.value !== saved.value;
  });
  onBeforeUnmount(() => {
    store.dirtyCommunitySettings = false;
  });
  const load = () => {
    const population = store.state?.population;
    if (!population) return;
    Object.assign(environment, {
      ...population.environment,
      ranks: population.environment.ranks.map((rank) => ({ ...rank })),
    });
    Object.assign(rules, population.rules);
    saved.value = JSON.stringify({ environment, rules });
    loaded.value = true;
  };
  watch(
    () => store.state?.population,
    () => {
      if (!loaded.value || encoded.value === saved.value) load();
    },
    { immediate: true },
  );
  async function save() {
    error.value = "";
    notice.value = "";
    working.value = true;
    try {
      await store.mutate(() =>
        studio.updateCommunitySettings({
          environment: {
            actorName: environment.actorName,
            currencyName: environment.currencyName,
            ranks: environment.ranks.map((rank) => ({ ...rank })),
          },
          rules: { ...rules },
        }),
      );
      load();
      notice.value = "Community settings saved. Existing balances are unchanged.";
    } catch (problem) {
      error.value =
        problem instanceof Error ? problem.message : "Community settings could not be saved. Your draft is kept.";
    } finally {
      working.value = false;
    }
  }
  return reactive({
    environment,
    rules,
    error,
    notice,
    working,
    dirty: computed(() => encoded.value !== saved.value),
    ruleFields: computed(
      () =>
        [
          { key: "coinsPerMinute", label: `${environment.currencyName || "Currency"} per chat-presence minute` },
          { key: "xpPerMinute", label: "XP per chat-presence minute" },
          { key: "screenedReputation", label: "Reputation per screened feature" },
          { key: "screenedXp", label: "XP per screened feature" },
          { key: "acceptedReputation", label: "Reputation per accepted feature" },
          { key: "acceptedXp", label: "XP per accepted feature" },
        ] as const,
    ),
    addRank: () => {
      if (environment.ranks.length < 100)
        environment.ranks.push({ name: "", minimumXp: (environment.ranks.at(-1)?.minimumXp ?? 0) + 100 });
      void nextTick(() => form.value?.querySelector<HTMLInputElement>(`[data-rank-name="${environment.ranks.length - 1}"]`)?.focus());
    },
    removeRank: (index: number) => {
      if (environment.ranks.length > 1) environment.ranks.splice(index, 1);
      void nextTick(() => form.value?.querySelector<HTMLInputElement>(`[data-rank-name="${Math.min(index, environment.ranks.length - 1)}"]`)?.focus());
    },
    save: (event: Event) => {
      event.preventDefault();
      void save();
    },
    revert: () => {
      load();
      error.value = "";
      notice.value = "";
    },
  });
}
