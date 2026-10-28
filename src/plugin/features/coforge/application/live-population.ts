import type { StudioService } from "./studio";
import type { Timers } from "./ports";
import type { IntegrationSettings } from "../domain/types";
import type { TwitchState } from "../domain/twitch";
import { creditPresence } from "./economy";
import { recordOperation } from "./population";
import { restrictionLease, syncRestrictions } from "./player-moderation";
import type { LivePresencePort } from "./integration-ports";
import { IntegrationFailure } from "../domain/integration-failure";
import { observeChatters } from './observe-chatters';
import { PresenceSubscriptionCache } from './presence-subscriptions';
import { presenceRestrictions } from './presence-restrictions';

/** Owned live polling: complete snapshots only, no offline/restart credit and no missed announcement replay. */
export class LivePopulationTracker {
  private timer: number | undefined;
  private generation = 0;
  private stopped = false;
  private pending: Promise<void> | undefined;
  private lastCheck = 0;
  private live: { id: string; checkedAt: number } | null = null;
  private previous: { streamId: string; at: number; users: Set<string> } | null = null;
  private readonly subscriptions: PresenceSubscriptionCache;
  constructor(
    private readonly studio: StudioService,
    private readonly api: LivePresencePort,
    private readonly timers: Timers,
    private readonly config: () => IntegrationSettings,
    private readonly ready: () => boolean,
    private readonly publish: (state: NonNullable<TwitchState["tracking"]>) => void,
  ) { this.subscriptions = new PresenceSubscriptionCache(api); }
  get liveStreamId(): string | null {
    return this.live && Date.now() - this.live.checkedAt <= 90_000 ? this.live.id : null;
  }
  start(): void {
    if (this.timer !== undefined || this.stopped) return;
    this.timer = this.timers.setInterval(() => {
      void this.tick();
    }, 60_000);
    void this.tick();
  }
  reset(): void {
    this.generation++;
    this.subscriptions.reset();
    this.previous = null;
    this.live = null;
    this.lastCheck = 0;
    this.publish({ phase: "idle", message: "Waiting for live channel and chat-presence permissions." });
  }
  stop(): void {
    this.stopped = true;
    this.generation++;
    this.subscriptions.reset();
    if (this.timer !== undefined) this.timers.clearInterval(this.timer);
    this.previous = null;
    this.live = null;
  }
  async refresh(): Promise<void> {
    if (this.pending) await this.pending;
    this.lastCheck = 0;
    await this.tick();
  }
  private async tick(): Promise<void> {
    if (this.stopped || this.pending) return;
    if (!this.ready()) {
      this.previous = null;
      this.live = null;
      return;
    }
    this.pending = this.run().finally(() => {
      this.pending = undefined;
    });
    await this.pending;
  }
  private async run(): Promise<void> {
    const generation = this.generation;
    const channelId = this.config().twitchBroadcasterId;
    const current = () =>
      !this.stopped && generation === this.generation && channelId === this.config().twitchBroadcasterId;
    try {
      if (!this.lastCheck || Date.now() - this.lastCheck >= 60_000) {
        this.lastCheck = Date.now();
        const stream = await this.api.liveStream();
        if (!current()) return;
        this.live = stream ? { id: stream.id, checkedAt: Date.now() } : null;
        if (!stream) {
          this.previous = null;
          this.publish({
            phase: "offline",
            message: "Channel is offline. Time credit and recurring messages are paused.",
            checkedAt: new Date().toISOString(),
          });
        } else {
          try {
            const profiles = this.api.chattersProfiles ? await this.api.chattersProfiles() : null;
            const users = new Set(profiles ? profiles.map(profile => profile.id) : await this.api.chatters());
            if (!current()) return;
            const observed = [...users].filter(id => /^twitch:\d+$/.test(id));
            const snapshot = this.studio.state();
            const premium = snapshot.population?.economy?.definition.premiumCurrencyPerMinute;
            const verifyPremium = premium !== undefined && premium !== snapshot.population?.rules.coinsPerMinute;
            const lease = restrictionLease(this.studio.store.internalSnapshot());
            const [banned, subscribers] = await Promise.all([
              presenceRestrictions(this.api, observed, current),
              verifyPremium ? this.subscriptions.read(channelId, observed, current) : Promise.resolve(undefined),
            ]);
            if (!current()) return;
            const at = Date.now();
            const previous = this.previous;
            await this.studio.store.transaction((state) => {
              if (!current()) return;
              const names = new Map(state.contributors.map(person => [person.id, person.name]));
              observeChatters(state, profiles ?? observed.map(id => ({ id, name: names.get(id) ?? 'Twitch viewer' })), new Date(at).toISOString());
              syncRestrictions(state, channelId, observed, banned, lease);
              if (previous?.streamId === stream.id)
                creditPresence(state, {
                  id: `${channelId}:${stream.id}:${at}`,
                  channelId,
                  from: previous.at,
                  to: at,
                  playerIds: observed.filter((id) => previous.users.has(id)),
                  ...(subscribers ? { subscribers } : {}),
                });
            });
            if (!current()) return;
            this.previous = { streamId: stream.id, at, users };
            this.publish({
              phase: "live",
              message: `Tracking live chat-presence time. This is not verified video watch time.${verifyPremium ? subscribers ? ' Subscriber income uses fresh current-channel verification.' : ' Subscriber verification unavailable; base income used for this sample.' : ''}`,
              checkedAt: new Date(at).toISOString(),
              streamId: stream.id,
              presentPlayers: observed.length,
            });
          } catch (error) {
            if (!current()) return;
            this.previous = null;
            await this.studio.store.transaction((state) => recordOperation(state, "presence-failed", "none"));
            this.publish({
              phase: "error",
              message:
                error instanceof IntegrationFailure
                  ? error.message
                  : "Chat presence could not be checked. No time was credited.",
              streamId: stream.id,
              checkedAt: new Date().toISOString(),
            });
          }
        }
      }
      if (!current()) return;
    } catch (error) {
      if (!current()) return;
      this.previous = null;
      this.live = null;
      this.publish({
        phase: "error",
        message:
          error instanceof IntegrationFailure
            ? error.message
            : "Live channel status could not be checked. Automatic stream messages are paused.",
      });
      try {
        await this.studio.store.transaction((state) => {
          recordOperation(state, "presence-failed", "none");
        });
      } catch {
        /* Reported in the tracker state; no side effects are replayed. */
      }
    }
  }
}
