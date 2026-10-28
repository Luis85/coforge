import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { achievedRank, defaultCommunityEnvironment } from "../../../features/coforge/domain/community-environment";
import type { ModerationAction } from "../../../features/coforge/domain/twitch";

type Action = "block" | "unblock" | "timeout" | "ban" | "unban";
function inputValue(event: Event): string | undefined {
  const target = event.target;
  return target && 'value' in target && typeof target.value === 'string' ? target.value : undefined;
}
export function usePopulation() {
  const { studio, host } = useCoforge();
  const store = useStudioStore();
  const query = ref("");
  const filter = ref("all");
  const page = ref(0);
  const selectedId = ref("");
  const now = ref(Date.now());
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
  onBeforeUnmount(() => window.clearInterval(timer));
  const error = ref("");
  const notice = ref("");
  const working = ref(false);
  const duration = ref(600);
  const reason = ref("");
  const confirmation = ref<{
    id: string;
    name: string;
    action: Action;
    channelId: string;
    text: string;
    duration: number;
    reason: string;
  } | null>(null);
  const channelId = computed(() => {
    void store.state;
    return studio.integration().twitchBroadcasterId;
  });
  // Stable aggregation is independent of the one-second countdown; only visible rows are decorated with time.
  const profiles = computed(() => {
    const state = store.state;
    const environment = state?.population?.environment ?? defaultCommunityEnvironment();
    const stats = new Map<string, { features: number; bugs: number; votes: number; accepted: number }>();
    const entry = (id: string) => {
      let value = stats.get(id);
      if (!value) {
        value = { features: 0, bugs: 0, votes: 0, accepted: 0 };
        stats.set(id, value);
      }
      return value;
    };
    for (const idea of state?.ideas ?? []) {
      const author = entry(idea.authorId);
      if (idea.requestKind === "bug") author.bugs++;
      else author.features++;
      if (idea.status === "shipped") author.accepted++;
      for (const id of new Set(idea.voters)) entry(id).votes++;
    }
    const names = new Map(state?.contributors.map((person) => [person.id, person.name]));
    return (state?.population?.players ?? [])
      .map((player) => {
        const rank = achievedRank(player.xp, environment);
        return {
          ...player,
          name: names.get(player.id) ?? player.id,
          rank: rank.position,
          rankName: player.registeredAt ? rank.name : 'Not registered',
          rankProgress: rank.next
            ? `${Math.max(0, rank.next.minimumXp - player.xp)} XP to ${rank.next.name}`
            : "Highest configured rank",
          twitchId: /^twitch:\d+$/.test(player.id) ? player.id.slice(7) : "",
          minutes: Math.floor(player.presenceSeconds / 60),
          lastSeen: new Date(player.lastSeenAt).toLocaleString(),
          registered: player.registeredAt ? new Date(player.registeredAt).toLocaleString() : 'Not registered',
          ...(stats.get(player.id) ?? { features: 0, bugs: 0, votes: 0, accepted: 0 }),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const timed = (player: (typeof profiles.value)[number]) => {
    const restriction = player.restriction?.channelId === channelId.value ? player.restriction : undefined;
    const banned = Boolean(restriction?.banned);
    const muted = Boolean(restriction?.expiresAt && Date.parse(restriction.expiresAt) > now.value);
    const uncertain = player.moderationPending?.channelId === channelId.value;
    return {
      ...player,
      banned,
      muted,
      uncertain,
      cooldown: player.lastFeatureAt
        ? Math.max(0, Math.ceil((Date.parse(player.lastFeatureAt) + 300_000 - now.value) / 1000))
        : 0,
      status: player.blocked
        ? "CoForge blocked"
        : uncertain
          ? "Check moderation"
          : banned
            ? "Twitch banned"
            : muted
              ? "Twitch muted"
              : player.twitchId && !restriction
                ? "Twitch unchecked"
                : player.registeredAt ? "Active" : 'Unregistered',
      restrictionChecked: restriction ? new Date(restriction.checkedAt).toLocaleString() : "Not checked",
    };
  };
  const filtered = computed(() =>
    profiles.value.filter((player) => {
      if (!`${player.name} ${player.id}`.toLowerCase().includes(query.value.toLowerCase())) return false;
      if (filter.value === "all") return true;
      if (filter.value === 'registered') return Boolean(player.registeredAt);
      if (filter.value === 'unregistered') return !player.registeredAt;
      const current = timed(player);
      return filter.value === "blocked"
        ? player.blocked
        : filter.value === "banned"
          ? current.banned
          : filter.value === "muted"
            ? current.muted
            : current.status === "Active";
    }),
  );
  watch([query, filter], () => {
    page.value = 0;
  });
  watch(
    () => filtered.value.length,
    (length) => {
      page.value = Math.min(page.value, Math.max(0, Math.ceil(length / 50) - 1));
    },
  );
  const selected = computed(() => {
    const player = profiles.value.find((player) => player.id === selectedId.value);
    return player ? timed(player) : undefined;
  });
  async function run(work: () => Promise<unknown>, success = "") {
    error.value = "";
    notice.value = "";
    working.value = true;
    try {
      await store.mutate(work);
      notice.value = success;
      return true;
    } catch (problem) {
      error.value = problem instanceof Error ? problem.message : "The player action could not be completed.";
      return false;
    } finally {
      working.value = false;
    }
  }
  function prepare(action: Action) {
    const player = selected.value;
    if (!player) return;
    if (
      action === "timeout" &&
      (!Number.isInteger(duration.value) || duration.value < 1 || duration.value > 1_209_600)
    ) {
      error.value = "Enter a timeout between 1 and 1,209,600 seconds.";
      return;
    }
    confirmation.value = {
      id: player.id,
      name: player.name,
      action,
      channelId: channelId.value,
      duration: duration.value,
      reason: reason.value.trim(),
      text:
        action === "block"
          ? `Block ${player.name} from CoForge requests, bugs, voting and rewards? Their history and balances are preserved.`
          : action === "unblock"
            ? `Restore ${player.name}'s CoForge participation? Any Twitch restriction still applies.`
            : action === "timeout"
              ? `Mute ${player.name} in Twitch chat for ${duration.value} seconds?`
              : action === "ban"
                ? `Ban ${player.name} from the Twitch channel?`
                : `Remove ${player.name}'s Twitch timeout or ban?`,
    };
  }
  async function confirm() {
    const pending = confirmation.value;
    if (!pending) return;
    const isLocal = pending.action === "block" || pending.action === "unblock";
    if (!isLocal && pending.channelId !== channelId.value) {
      confirmation.value = null;
      error.value = "The channel changed. Review this action again.";
      return;
    }
    const seconds = pending.duration;
    const why = pending.reason;
    confirmation.value = null;
    await run(
      async () => {
        if (isLocal) return studio.blockPlayer(pending.id, pending.action === "block");
        if (!host.twitch || !/^twitch:\d+$/.test(pending.id))
          throw new Error("This action needs a Twitch player and a connected streamer account.");
        const action: ModerationAction =
          pending.action === "unban"
            ? { type: "unban", userId: pending.id.slice(7) }
            : {
                type: pending.action === "ban" ? "ban" : "timeout",
                userId: pending.id.slice(7),
                duration: seconds,
                reason: why.trim(),
              };
        await host.twitch.moderate(action);
      },
      isLocal
        ? `${pending.name}: CoForge participation updated.`
        : `${pending.name}: Twitch confirmed the moderation action.`,
    );
  }
  return reactive({
    setDuration: (event: Event) => { const value = inputValue(event); if (value !== undefined) duration.value = Number(value); },
    setReason: (event: Event) => { const value = inputValue(event); if (value !== undefined) reason.value = value; },
    store,
    query,
    filter,
    page,
    selected,
    selectedId,
    actorName: computed(() => store.state?.population?.environment.actorName ?? "Agent"),
    currencyName: computed(() => store.state?.population?.environment.currencyName ?? "gold"),
    error,
    notice,
    working,
    openChat: () => store.navigate('stream'),
    clearFilters: () => { query.value = ''; filter.value = 'all'; page.value = 0; },
    duration,
    reason,
    confirmation,
    rows: computed(() => filtered.value.slice(page.value * 50, page.value * 50 + 50).map(timed)),
    total: computed(() => profiles.value.length),
    registeredTotal: computed(() => profiles.value.filter(player => player.registeredAt).length),
    canOpenNote: computed(() => Boolean(host.viewerNotes && selected.value?.twitchId)),
    openNote: () => { if (selected.value && host.viewerNotes) void run(() => host.viewerNotes!.open(selected.value!.id)); },
    refreshNotes: () => { if (host.viewerNotes) void run(() => host.viewerNotes!.refresh(), 'Private viewer note sync requested.'); },
    notesStatus: computed(() => { void now.value; return host.viewerNotes?.status(); }),
    notesAvailable: Boolean(host.viewerNotes),
    matching: computed(() => filtered.value.length),
    pages: computed(() => Math.max(1, Math.ceil(filtered.value.length / 50))),
    coins: computed(() => profiles.value.reduce((total, player) => total + player.coins, 0)),
    tracking: computed(
      () => store.state?.runtime.twitch?.tracking?.message ?? "Live chat-presence tracking has not started.",
    ),
    canModerate: computed(() =>
      Boolean(
        host.twitch &&
        store.state?.runtime.twitch?.canModerate &&
        selected.value?.twitchId &&
        selected.value.twitchId !== channelId.value &&
        !selected.value.uncertain,
      ),
    ),
    canRefresh: computed(() =>
      Boolean(host.twitch?.refreshPlayer && selected.value?.twitchId && store.state?.runtime.twitch?.streamer),
    ),
    rewards: computed(() =>
      (store.state?.population?.rewards ?? [])
        .filter((entry) => entry.playerId === selectedId.value)
        .slice(-10)
        .reverse(),
    ),
    prepare,
    confirm: () => {
      void confirm();
    },
    cancel: () => {
      confirmation.value = null;
    },
    refresh: () => {
      const id = selected.value?.twitchId;
      if (id)
        void run(async () => {
          if (!host.twitch?.refreshPlayer) throw new Error("Refresh is available in Obsidian.");
          await host.twitch.refreshPlayer(id);
        }, "Twitch restriction status refreshed.");
    },
    select: (id: string) => {
      selectedId.value = id;
      confirmation.value = null;
      error.value = "";
      notice.value = "";
      reason.value = "";
    },
  });
}
export type PopulationModel = ReturnType<typeof usePopulation>;
