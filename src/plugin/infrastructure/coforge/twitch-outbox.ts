import type { StudioService } from '../../features/coforge/application/studio';
import type { Timers } from '../../features/coforge/application/ports';
import type { TwitchIdentity } from '../../features/coforge/domain/twitch';
import { TwitchApi } from './twitch-api';
import { TwitchError } from './twitch-http';

/** Persists send intent before HTTP. Ambiguous sends are held for inspection, never silently replayed. */
export class TwitchOutbox {
  private running: Promise<void> | null = null;
  private stopped = false;
  private blocked = false;
  private timer: number | undefined;
  private release: (() => void) | undefined;
  private lastSent = 0;
  private readonly rateAttempts = new Map<string, number>();
  constructor(private readonly studio: StudioService, private readonly api: TwitchApi, private readonly ready: () => boolean,
    private readonly identity: () => TwitchIdentity | undefined, private readonly report: (message: string) => void, private readonly timers: Timers) {}
  wake(): void {
    if (this.stopped || this.blocked || this.running || !this.ready()) return;
    this.running = this.drain().catch(() => { this.blocked = true; this.report('Bot delivery state could not be saved. Check vault access and reconnect the bot.'); })
      .finally(() => { this.running = null; });
  }
  resume(): void { this.blocked = false; this.wake(); }
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.release?.(); await this.running;
  }
  async retry(id: string): Promise<void> {
    await this.studio.store.transaction(state => {
      const reply = state.botReplies.find(reply => reply.id === id);
      if (!reply || reply.status !== 'failed') throw new Error('Only a confirmed failed reply can be retried. Unconfirmed sends must be checked in Twitch.');
      reply.status = 'pending'; reply.createdAt = new Date().toISOString(); delete reply.error;
    });
    this.rateAttempts.delete(id); this.resume();
  }
  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => { this.release = resolve; this.timer = this.timers.setTimeout(() => { this.release = undefined; this.timer = undefined; resolve(); }, ms); });
  }
  private async drain(): Promise<void> {
    while (!this.stopped && this.ready()) {
      const reply = this.studio.state().botReplies?.find(reply => reply.status === 'pending');
      if (!reply) return;
      if (Date.now() - Date.parse(reply.createdAt) > 120_000) {
        await this.studio.store.transaction(state => { const item = state.botReplies.find(item => item.id === reply.id); if (item) { item.status = 'failed'; item.error = 'Reply expired while disconnected. It was not sent.'; } });
        continue;
      }
      await this.wait(Math.max(0, this.lastSent + 2000 - Date.now()));
      if (this.stopped || !this.ready()) return;
      await this.studio.store.transaction(state => { const item = state.botReplies.find(item => item.id === reply.id); if (item?.status === 'pending') item.status = 'sending'; });
      try {
        const messageId = await this.api.send(reply.text, reply.parentMessageId, reply.senderId, reply.channelId);
        this.lastSent = Date.now();
        await this.studio.store.transaction(state => {
          const item = state.botReplies.find(item => item.id === reply.id);
          if (item) { item.status = 'sent'; item.messageId = messageId; delete item.error; }
          state.chat.push({ id: crypto.randomUUID(), userId: 'system:coforge', username: this.identity()?.login ?? 'CoForge', text: reply.text,
            kind: 'system', source: 'twitch', externalId: messageId, twitchChannelId: reply.channelId, createdAt: new Date().toISOString() });
        });
      } catch (error) {
        const rate = error instanceof TwitchError && error.kind === 'rate';
        const attempts = (this.rateAttempts.get(reply.id) ?? 0) + 1; this.rateAttempts.set(reply.id, attempts);
        await this.studio.store.transaction(state => {
          const item = state.botReplies.find(item => item.id === reply.id);
          if (!item) return;
          item.status = rate && attempts <= 3 ? 'pending' : error instanceof TwitchError && ['uncertain', 'service'].includes(error.kind) ? 'uncertain' : 'failed';
          item.error = error instanceof TwitchError ? error.message : 'Delivery could not be confirmed. Check Twitch before sending again.';
          if (!(error instanceof TwitchError)) item.status = 'uncertain';
        });
        if (rate && attempts <= 3) await this.wait(10_000 * attempts);
        else this.report(error instanceof TwitchError ? error.message : 'A bot reply could not be confirmed.');
      }
    }
  }
}
