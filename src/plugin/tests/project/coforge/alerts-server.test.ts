import { request } from 'node:http';
import { expect, it } from 'vitest';
import { LocalAlertsServer } from '../../../infrastructure/coforge/alerts-server';
import { alertImageUrl, alertStream } from './alert-http-fixture';

function requestStatus(url: string, headers: Record<string, string>): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const call = request(url, { headers }, response => { response.resume(); resolve(response.statusCode); });
    call.once('error', reject); call.end();
  });
}
const cue = { text: '<script>literal</script>', image: 'Alerts/party.gif', audio: '', video: '', duration: 1, volume: 0.5 };
function makeServer() {
  return new LocalAlertsServer({ endpoint: async () => ({ port: 0, token: 'test-token' }), saveEndpoint: async () => {},
    mediaAllowed: path => path === 'Alerts/party.gif' || path === 'Alerts/large.gif',
    media: async path => path.endsWith('large.gif') ? new Uint8Array(25 * 1024 * 1024 + 1).buffer : new Uint8Array([71, 73, 70]).buffer });
}

it('ALERTS-04 serves a read-only transparent source and rejects unselected assets and hostile request contexts', async () => {
  const server = makeServer(); const url = await server.start();
  let source: Awaited<ReturnType<typeof alertStream>> | undefined;
  try {
    const page = await fetch(url); expect(page.status).toBe(200);
    expect(await page.text()).toContain('<main id="alert"');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect((await fetch(url + 'player.css')).status).toBe(200);
    expect(await (await fetch(url + 'player.js')).text()).toContain('textContent');
    expect((await fetch(url + 'events', { method: 'POST' })).status).toBe(405);
    expect(await requestStatus(url, { Origin: 'https://hostile.example' })).toBe(403);
    expect(await requestStatus(url, { Host: 'hostile.example' })).toBe(403);
    expect(await requestStatus(url, { 'Sec-Fetch-Site': 'cross-site' })).toBe(403);
    expect((await fetch(url.replace('test-token', 'wrong'))).status).toBe(404);
    source = await alertStream(url); server.send(cue);
    const publicCue = await source.event('cue');
    expect(publicCue).not.toContain('Alerts/'); expect(publicCue).not.toContain('party.gif');
    const media = await fetch(alertImageUrl(publicCue, url));
    expect(media.headers.get('content-type')).toBe('image/gif'); expect(await media.text()).toBe('GIF');
    expect((await fetch(url + 'media/' + encodeURIComponent('Alerts/party.gif'))).status).toBe(404);
    for (const path of ['Private/note.md', '../outside.gif', 'Unselected/image.gif', 'Alerts/file.html'])
      expect((await fetch(url + 'media/' + encodeURIComponent(path))).status).toBe(404);
    expect((await fetch(url + 'media/%ZZ')).status).toBe(404);
    server.send({ ...cue, image: 'Alerts/large.gif' });
    expect((await fetch(alertImageUrl(await source.event('cue'), url))).status).toBe(413);
  } finally { await source?.close(); await server.close(); }
  await expect(fetch(url)).rejects.toThrow();
});

it('broadcasts only future cues to each connected source, reports counts, and never replays after reconnect', async () => {
  const server = makeServer(); const counts: number[] = [];
  const stop = server.subscribeSources(count => { counts.push(count); });
  const url = await server.start(); const streams: Array<Awaited<ReturnType<typeof alertStream>>> = [];
  try {
    expect(server.send({ ...cue, text: 'Missed alert' })).toBe(0);
    const first = await alertStream(url); const second = await alertStream(url); streams.push(first, second);
    expect(counts.at(-1)).toBe(2); expect(server.send(cue)).toBe(2);
    for (const stream of streams) {
      const frame = await stream.event('cue');
      expect(new URL(alertImageUrl(frame, url)).pathname).toMatch(/\/media\/[a-f0-9]{48}$/);
      expect(frame).not.toContain('Alerts/'); expect(frame).not.toContain('party.gif'); expect(frame).toContain('literal');
      expect(frame).not.toContain('Missed alert'); expect(frame).not.toContain('templates');
    }
    server.clear(); for (const stream of streams) expect(await stream.event('clear')).toBe('{}');
    await first.close(); await second.close(); streams.length = 0;
    const reconnected = await alertStream(url); streams.push(reconnected);
    server.send({ ...cue, text: 'Future only' });
    expect(await reconnected.event('cue')).toContain('Future only');
  } finally { for (const stream of streams) await stream.close(); stop(); await server.close(); }
});

it('retains the stored endpoint and closes the listener when persisting its identity fails', async () => {
  let endpoint = { port: 0, token: 'stable-token' };
  const host = { endpoint: async () => endpoint, saveEndpoint: async (next: typeof endpoint) => { endpoint = next; }, mediaAllowed: () => false, media: async () => new ArrayBuffer(0) };
  const first = new LocalAlertsServer(host); const url = await first.start(); await first.close();
  const reloaded = new LocalAlertsServer(host);
  try { expect(await reloaded.start()).toBe(url); } finally { await reloaded.close(); }
  const broken = new LocalAlertsServer({ ...host, saveEndpoint: async () => { throw new Error('Disk full'); } });
  await expect(broken.start()).rejects.toThrow('Disk full'); await expect(fetch(url)).rejects.toThrow();
  const retry = new LocalAlertsServer(host);
  try { expect(await retry.start()).toBe(url); } finally { await retry.close(); }
});

it('reports an occupied saved port without changing identity or interrupting its current listener', async () => {
  let endpoint = { port: 0, token: 'stable-token' };
  const host = { endpoint: async () => endpoint, saveEndpoint: async (next: typeof endpoint) => { endpoint = next; }, mediaAllowed: () => false, media: async () => new ArrayBuffer(0) };
  const first = new LocalAlertsServer(host); const url = await first.start();
  const blocked = new LocalAlertsServer(host);
  try {
    await expect(blocked.start()).rejects.toThrow();
    expect(`http://127.0.0.1:${endpoint.port}/alerts/${endpoint.token}/`).toBe(url);
    expect((await fetch(url)).status).toBe(200);
  } finally { await blocked.close(); await first.close(); }
});
