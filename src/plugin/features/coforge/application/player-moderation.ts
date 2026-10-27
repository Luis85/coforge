import type { InternalState } from "./ports";
import type { StudioStore } from "./studio-store";
import type { ModerationAction } from "../domain/twitch";
import type { ChannelRestriction, PlayerModerationPort } from "./integration-ports";
import { IntegrationFailure } from "../domain/integration-failure";
import { recordOperation } from "./population";

const restrictionVersion = (player: InternalState["population"]["players"][number]) =>
  JSON.stringify([player.moderationPending ?? null, player.restriction ?? null]);
export function restrictionLease(state: Pick<InternalState, "population">): ReadonlyMap<string, string> {
  return new Map(state.population.players.map((player) => [player.id, restrictionVersion(player)]));
}
/** Stale reads cannot overwrite a moderation action that started or completed after the read began. */
export function syncRestrictions(
  state: InternalState,
  channelId: string,
  users: readonly string[],
  banned: readonly ChannelRestriction[],
  lease: ReadonlyMap<string, string>,
): void {
  const restrictions = new Map(banned.map((item) => [`twitch:${item.userId}`, item]));
  const selected = new Set(users);
  for (const player of state.population.players) {
    if (!selected.has(player.id) || restrictionVersion(player) !== lease.get(player.id)) continue;
    const restriction = restrictions.get(player.id);
    delete player.moderationPending;
    player.restriction = {
      channelId,
      checkedAt: new Date().toISOString(),
      banned: Boolean(restriction && !restriction.expiresAt),
      ...(restriction?.expiresAt ? { expiresAt: restriction.expiresAt } : {}),
    };
  }
}
/** Orchestrates durable intent, external effects and confirmation. It has no Twitch transport or UI dependency. */
export class PlayerModeration {
  constructor(
    private readonly store: StudioStore,
    private readonly provider: PlayerModerationPort,
    private readonly channel: () => string,
  ) {}
  async refresh(userId: string): Promise<void> {
    const channelId = this.channel();
    const lease = restrictionLease(this.store.internalSnapshot());
    const restrictions = await this.provider.restrictions([userId]);
    if (channelId !== this.channel())
      throw new IntegrationFailure("validation", "The channel changed. Refresh the player again.");
    await this.store.transaction((state) => {
      if (channelId === this.channel()) syncRestrictions(state, channelId, [`twitch:${userId}`], restrictions, lease);
    });
  }
  async execute(action: ModerationAction): Promise<void> {
    const channelId = this.channel();
    const playerId = action.type === "delete" ? undefined : `twitch:${action.userId}`;
    await this.store.transaction((state) => {
      const player = state.population.players.find((player) => player.id === playerId);
      if (player?.moderationPending?.channelId === channelId)
        throw new IntegrationFailure(
          "uncertain",
          "The previous moderation outcome is unconfirmed. Refresh this player from Twitch before another action.",
        );
      if (player)
        player.moderationPending = { channelId, at: new Date().toISOString(), operationId: crypto.randomUUID() };
      recordOperation(state, "moderation-started", "none", playerId);
    });
    try {
      if (channelId !== this.channel())
        throw new IntegrationFailure("validation", "The channel changed before this action. Review it again.");
      const receipt = await this.provider.moderate(action);
      await this.store.transaction((state) => {
        const player = state.population.players.find((player) => player.id === playerId);
        if (player && action.type !== "delete")
          player.restriction = {
            channelId,
            checkedAt: new Date().toISOString(),
            banned: action.type === "ban",
          ...(action.type === "timeout" && action.duration
            ? { expiresAt: receipt?.expiresAt ?? new Date(Date.now() + action.duration * 1000).toISOString() }
              : {}),
          };
        if (player) delete player.moderationPending;
        recordOperation(state, "moderation-confirmed", "committed", playerId);
      });
    } catch (error) {
      const uncertain = !(error instanceof IntegrationFailure) || error.kind === "uncertain";
      try {
        await this.store.transaction((state) => {
          const player = state.population.players.find((player) => player.id === playerId);
          if (player && !uncertain) delete player.moderationPending;
          recordOperation(
            state,
            uncertain ? "moderation-uncertain" : "moderation-failed",
            uncertain ? "uncertain" : "none",
            playerId,
          );
        });
      } catch {
        /* A failed audit write never licenses repeating an external moderation effect. */
      }
      throw error;
    }
  }
}
