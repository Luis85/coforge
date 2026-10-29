import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import * as nodeTimers from 'node:timers';
import { randomBytes } from 'node:crypto';
import type { AlertCue } from '../../features/coforge/domain/alerts';
import { alertMediaType } from '../../features/coforge/domain/alerts';
import type { AlertsTransport } from '../../features/coforge/application/alerts-ports';
import { alertsHtml, alertsPlayer, alertsPlayerCss } from './alerts-player';

export interface AlertEndpoint { port: number; token: string }
export interface AlertsServerHost {
  endpoint(): Promise<AlertEndpoint>;
  saveEndpoint(endpoint: AlertEndpoint): Promise<void>;
  mediaAllowed(path: string): boolean;
  media(path: string): Promise<ArrayBuffer>;
}
const MAX_MEDIA = 25 * 1024 * 1024;

/** Read-only loopback source. The opaque URL cannot dispatch alerts or browse the vault. */
export class LocalAlertsServer implements AlertsTransport {
  private server: Server | undefined;
  private readonly clients = new Set<ServerResponse>();
  private readonly sourceListeners = new Set<(sources: number) => void>();
  private readonly mediaPaths = new Map<string, string>();
  private readonly mediaIds = new Map<string, string>();
  private origin = '';
  private root = '';
  private heartbeat: ReturnType<typeof nodeTimers.setInterval> | undefined;
  constructor(private readonly host: AlertsServerHost) {}
  async start(): Promise<string> {
    if (this.server) throw new Error('The Alerts source is already running.');
    const endpoint = await this.host.endpoint();
    const server = createServer((request, response) => {
      void this.handle(request, response).catch(() => {
        if (!response.headersSent) response.writeHead(500);
        response.end('Alert media unavailable. Check the selected file.');
      });
    });
    server.requestTimeout = 15_000; server.headersTimeout = 10_000; server.maxConnections = 32;
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(endpoint.port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Alerts loopback address unavailable.');
      this.origin = `http://127.0.0.1:${address.port}`;
      this.root = `/alerts/${endpoint.token}/`;
      await this.host.saveEndpoint({ ...endpoint, port: address.port });
      this.heartbeat = nodeTimers.setInterval(() => { for (const client of this.clients) this.write(client, ': heartbeat\n\n'); }, 15_000);
      return this.origin + this.root;
    } catch (error) { await this.close(); throw error; }
  }
  subscribeSources(listener: (sources: number) => void): () => void {
    this.sourceListeners.add(listener);
    try { listener(this.clients.size); } catch { /* A new observer cannot change the source lifecycle. */ }
    return () => { this.sourceListeners.delete(listener); };
  }
  private changedSources(): void {
    for (const listener of this.sourceListeners) { try { listener(this.clients.size); } catch { /* Source observers cannot change network effects. */ } }
  }
  private drop(response: ServerResponse): void {
    const changed = this.clients.delete(response); response.destroy();
    if (changed) this.changedSources();
  }
  /** Includes heartbeat writes: a stalled page never receives an unbounded user-memory queue. */
  private write(response: ServerResponse, frame: string): boolean {
    if (response.destroyed || response.writableEnded || response.writableLength + Buffer.byteLength(frame) > 64 * 1024) {
      this.drop(response); return false;
    }
    try { response.write(frame); return true; }
    catch { this.drop(response); return false; }
  }
  send(cue: AlertCue): number {
    this.pruneMedia();
    const media = (path: string) => {
      if (!path) return '';
      if (!this.host.mediaAllowed(path)) throw new Error('Selected alert media is no longer available. Refresh this alert before dispatching.');
      let id = this.mediaIds.get(path);
      if (!id) {
        if (this.mediaPaths.size >= 300) throw new Error('The selected alert media allowance is full. Remove unused media before dispatching.');
        id = randomBytes(24).toString('hex'); this.mediaIds.set(path, id); this.mediaPaths.set(id, path);
      }
      return `${this.root}media/${id}`;
    };
    return this.broadcast('cue', { text: cue.text, image: media(cue.image), audio: media(cue.audio), video: media(cue.video), duration: cue.duration, volume: cue.volume });
  }
  private pruneMedia(): void {
    for (const [id, path] of this.mediaPaths) if (!this.host.mediaAllowed(path)) { this.mediaPaths.delete(id); this.mediaIds.delete(path); }
  }
  clear(): void { this.pruneMedia(); this.broadcast('clear', {}); }
  private broadcast(event: string, data: unknown): number {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let sources = 0;
    for (const response of this.clients) if (this.write(response, frame)) sources++;
    return sources;
  }
  async close(): Promise<void> {
    this.clear(); nodeTimers.clearInterval(this.heartbeat); this.heartbeat = undefined;
    for (const response of this.clients) response.destroy();
    this.clients.clear(); this.mediaPaths.clear(); this.mediaIds.clear(); this.changedSources(); const server = this.server; this.server = undefined; this.origin = ''; this.root = '';
    if (server) await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
  }
  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }); response.end(); return; }
    const origin = request.headers.origin;
    if (!this.origin || request.headers.host !== this.origin.slice(7) || origin && origin !== this.origin || request.headers['sec-fetch-site'] === 'cross-site') {
      response.writeHead(403); response.end(); return;
    }
    const url = request.url ?? '';
    if (!this.root || !url.startsWith(this.root)) { response.writeHead(404); response.end(); return; }
    const route = url.slice(this.root.length);
    if (route === 'events') {
      if (this.clients.size >= 16) { response.writeHead(503); response.end(); return; }
      response.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
      this.clients.add(response);
      response.on('close', () => { if (this.clients.delete(response)) this.changedSources(); });
      this.changedSources(); this.write(response, ': connected; no history replay\n\n'); return;
    }
    const staticFiles = new Map([
      ['', ['text/html; charset=utf-8', alertsHtml()]],
      ['player.js', ['text/javascript; charset=utf-8', `(${alertsPlayer.toString()})();`]],
      ['player.css', ['text/css; charset=utf-8', alertsPlayerCss]],
    ]);
    const asset = staticFiles.get(route);
    if (asset) { response.writeHead(200, { 'Content-Type': asset[0] ?? 'text/plain' }); response.end(asset[1]); return; }
    if (!route.startsWith('media/')) { response.writeHead(404); response.end(); return; }
    const id = route.slice(6);
    const path = /^[a-f0-9]{48}$/.test(id) ? this.mediaPaths.get(id) : undefined;
    if (!path) { response.writeHead(404); response.end(); return; }
    const type = alertMediaType(path);
    if (!type || !this.host.mediaAllowed(path)) { response.writeHead(404); response.end(); return; }
    const data = Buffer.from(await this.host.media(path));
    if (data.length > MAX_MEDIA) { response.writeHead(413); response.end(); return; }
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length }); response.end(data);
  }
}
