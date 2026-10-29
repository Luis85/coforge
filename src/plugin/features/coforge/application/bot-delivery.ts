import type { StudioService } from "./studio";
import type { Timers } from "./ports";
import type { TwitchIdentity } from "../domain/twitch";
import type { ChatSenderPort } from "./integration-ports";
import { IntegrationFailure } from "../domain/integration-failure";
import { recordOperation } from "./population";
import { publicReplyBlocked } from './public-reply-policy';

/** Persists send intent before HTTP. Ambiguous sends are held for inspection, never silently replayed. */
export class BotDeliveryWorker {
  private running: Promise<void> | null = null;
  private stopped = false;
  private blocked = false;
  private timer: number | undefined;
  private release: (() => void) | undefined;
  private lastSent = 0;
  private readonly rateAttempts = new Map<string, number>();
  constructor(
    private readonly studio: StudioService,
    private readonly api: ChatSenderPort,
    private readonly ready: () => boolean,
    private readonly identity: () => TwitchIdentity | undefined,
    private readonly report: (message: string) => void,
    private readonly timers: Timers,
    private readonly recurringReady: () => boolean = () => true,
  ) {}
  wake(): void {
    if (this.stopped || this.blocked || this.running || !this.ready()) return;
    this.running = this.drain()
      .catch(() => {
        this.blocked = true;
        this.report("Bot delivery state could not be saved. Check vault access and reconnect the bot.");
      })
      .finally(() => {
        this.running = null;
        if (this.studio.store.pendingBotReply()) this.wake();
      });
  }
  resume(): void {
    this.blocked = false;
    this.wake();
  }
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.release?.();
    await this.running;
    this.rateAttempts.clear();
  }
  async retry(id: string): Promise<void> {
    await this.studio.store.transaction((state) => {
      const reply = state.botReplies.find((reply) => reply.id === id);
      if (!reply || reply.status !== "failed")
        throw new Error("Only a confirmed failed reply can be retried. Unconfirmed sends must be checked in Twitch.");
      if (reply.streamMessageId)
        throw new Error(
          "Review and activate this recurring message under Bot messages instead of retrying an old occurrence.",
        );
      reply.status = "pending";
      reply.createdAt = new Date().toISOString();
      delete reply.error;
      const greeted = state.population.players.find((player) => player.id === reply.greetingPlayerId);
      if (greeted) greeted.greetedAt = reply.createdAt;
    });
    this.rateAttempts.delete(id);
    this.resume();
  }
  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.release = resolve;
      this.timer = this.timers.setTimeout(() => {
        this.release = undefined;
        this.timer = undefined;
        resolve();
      }, ms);
    });
  }
  private async drain(): Promise<void> {
    while (!this.stopped && this.ready()) {
      const reply = this.studio.store.pendingBotReply();
      if (!reply) return;
      if (Date.now() - Date.parse(reply.createdAt) > 120_000) {
        await this.studio.store.transaction((state) => {
          const item = state.botReplies.find((item) => item.id === reply.id);
          if (item) {
            item.status = "failed";
            item.error = "Reply expired while disconnected. It was not sent.";
            const greeted = state.population.players.find((player) => player.id === item.greetingPlayerId);
            if (greeted) delete greeted.greetedAt;
            recordOperation(state, "reply-failed", "none");
          }
        });
        continue;
      }
      await this.wait(Math.max(0, this.lastSent + 2000 - Date.now()));
      if (this.stopped || !this.ready()) return;
      const sending = await this.studio.store.transaction((state) => {
        const item = state.botReplies.find((item) => item.id === reply.id);
        if (item?.status !== "pending") return false;
        if (publicReplyBlocked(state, item)) { item.status = 'cancelled'; recordOperation(state, 'reply-privacy-cancelled', 'none'); return false; }
        if (
          item.streamMessageId &&
          (!this.recurringReady() ||
            !state.streamMessages.some(
              (message) =>
                message.id === item.streamMessageId && message.active && message.streamKey === item.streamKey,
            ))
        ) {
          item.status = "cancelled";
          return false;
        }
        item.status = "sending";
        return true;
      });
      if (!sending) continue;
      if (!this.studio.store.publicReplyAllowed(reply.id)) {
        await this.studio.store.transaction(state => {
          const item = state.botReplies.find(item => item.id === reply.id);
          if (item?.status === 'sending') { item.status = 'cancelled'; recordOperation(state, 'reply-privacy-cancelled', 'none'); }
        });
        continue;
      }
      try {
        this.lastSent = Date.now();
        const messageId = await this.api.send(reply.text, reply.parentMessageId, reply.senderId, reply.channelId);
        this.rateAttempts.delete(reply.id);
        await this.studio.store.transaction((state) => {
          const item = state.botReplies.find((item) => item.id === reply.id);
          if (item) {
            item.status = "sent";
            item.messageId = messageId;
            delete item.error;
          }
          const recurring = state.streamMessages.find((message) => message.id === item?.streamMessageId);
          if (recurring) {
            recurring.lastSentAt = new Date().toISOString();
            delete recurring.lastError;
          }
          recordOperation(state, "reply-confirmed");
          state.chat.push({
            id: crypto.randomUUID(),
            userId: "system:coforge",
            username: this.identity()?.login ?? "CoForge",
            text: reply.text,
            kind: "system",
            source: "twitch",
            externalId: messageId,
            twitchChannelId: reply.channelId,
            createdAt: new Date().toISOString(),
          });
        });
      } catch (error) {
        const rate = error instanceof IntegrationFailure && error.kind === "rate";
        const attempts = rate ? (this.rateAttempts.get(reply.id) ?? 0) + 1 : 0;
        if (rate && attempts <= 3) this.rateAttempts.set(reply.id, attempts);
        else this.rateAttempts.delete(reply.id);
        await this.studio.store.transaction((state) => {
          const item = state.botReplies.find((item) => item.id === reply.id);
          if (!item) return;
          item.status =
            rate && attempts <= 3
              ? "pending"
              : error instanceof IntegrationFailure && ["uncertain", "service"].includes(error.kind)
                ? "uncertain"
                : "failed";
          item.error =
            error instanceof IntegrationFailure
              ? error.message
              : "Delivery could not be confirmed. Check Twitch before sending again.";
          if (!(error instanceof IntegrationFailure)) item.status = "uncertain";
          if (item.status !== "pending") {
            const greeted = state.population.players.find((player) => player.id === item.greetingPlayerId);
            if (greeted && item.status === "failed") delete greeted.greetedAt;
            recordOperation(
              state,
              item.status === "uncertain" ? "reply-uncertain" : "reply-failed",
              item.status === "uncertain" ? "uncertain" : "none",
            );
            const message = state.streamMessages.find((message) => message.id === item.streamMessageId);
            if (message) {
              message.active = false;
              message.lastError = item.error;
              delete message.nextDueAt;
            }
          }
        });
        if (rate && attempts <= 3) await this.wait(10_000 * attempts);
        else this.report(error instanceof IntegrationFailure ? error.message : "A bot reply could not be confirmed.");
      }
    }
  }
}
