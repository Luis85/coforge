import { request } from 'node:http';
import * as nodeTimers from 'node:timers';
import { record, text } from '../../../features/coforge/domain/check';

export const alertImageUrl = (frame: string, base: string): string => new URL(text({ min: 1 })(record(JSON.parse(frame)).image), base).href;

export async function alertHttp(url: string) {
  return new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    const call = request(url, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); });
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      response.once('error', reject);
    });
    call.once('error', reject); call.end();
  });
}

/** Node HTTP keeps the server seam independent of happy-dom's browser-origin policy. */
export async function alertStream(url: string) {
  const call = request(url + 'events');
  const response = await new Promise<import('node:http').IncomingMessage>((resolve, reject) => { call.once('response', resolve); call.once('error', reject); call.end(); });
  if (response.statusCode !== 200) { response.resume(); call.destroy(); throw new Error(`Alert source returned ${response.statusCode}`); }
  const frames: string[] = []; const waiting: Array<(frame: string) => void> = [];
  let buffer = ''; let failure: Error | undefined;
  const receive = (frame: string) => { const listener = waiting.shift(); if (listener) listener(frame); else frames.push(frame); };
  response.setEncoding('utf8');
  response.on('data', chunk => {
    buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    buffer = buffer.replaceAll('\r\n', '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) { receive(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); boundary = buffer.indexOf('\n\n'); }
  });
  response.on('error', error => { failure = error; });
  async function nextFrame(): Promise<string> {
    const frame = frames.shift(); if (frame !== undefined) return frame;
    if (failure) throw failure;
    let expire: ReturnType<typeof nodeTimers.setTimeout> | undefined;
    try {
      return await Promise.race([
        new Promise<string>(resolve => { waiting.push(resolve); }),
        new Promise<never>((_resolve, reject) => { expire = nodeTimers.setTimeout(() => reject(new Error('No SSE frame arrived within 10 seconds')), 10_000); }),
      ]);
    } finally { nodeTimers.clearTimeout(expire); }
  }
  const connected = await nextFrame();
  if (!connected.includes('connected')) throw new Error('Alert stream did not complete its connection handshake');
  return {
    async event(kind: string): Promise<string> {
      for (;;) {
        const frame = await nextFrame();
        if (frame.startsWith(':')) continue;
        if (!frame.includes(`event: ${kind}\n`)) throw new Error(`Expected ${kind}, received ${frame}`);
        return frame.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
      }
    },
    async close() { response.destroy(); call.destroy(); },
  };
}
