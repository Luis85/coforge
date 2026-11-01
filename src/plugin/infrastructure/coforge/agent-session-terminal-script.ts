/** Fixed observer only: no stdin, provider RPC, shell command or dynamic module loading. */
export const sessionFollowerSource = String.raw`'use strict';
const fs = require('node:fs/promises');
const feed = process.argv[2];
let previous = '', stopped = false, disconnected = false, reading = false;
process.stdin.on('error', () => {});
const safe = value => String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu, '');
const wrap = text => {
  const width = Math.max(20, Math.min(80, process.stdout.columns || Number(process.env.COFORGE_FOLLOW_COLUMNS) || 60)) - 1;
  return text.split('\n').map(line => {
    let result = '', column = 0;
    for (const character of line.replace(/\t/gu, '    ')) {
      const size = character.codePointAt(0) >= 4352 ? 2 : 1;
      if (column + size > width) { result += '\n'; column = 0; }
      result += character; column += size;
    }
    return result;
  }).join('\n');
};
const observe = async () => {
  if (stopped || reading) return;
  reading = true;
  try {
    const info = await fs.lstat(feed);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 262144) throw new Error('Invalid observation feed');
    const value = JSON.parse(await fs.readFile(feed, 'utf8'));
    if (value.version !== 1 || typeof value.text !== 'string' || typeof value.closed !== 'boolean') throw new Error('Invalid observation feed');
    const stale = Date.now() - info.mtimeMs > 5000 ? 'Feed disconnected; showing last recorded observations. The agent may still be running.\n\n' : '';
    const text = stale + safe(value.text).slice(0, 100000);
    if (text !== previous) { process.stdout.write('\u001b[2J\u001b[H' + wrap(text) + '\n'); previous = text; }
    disconnected = false;
    if (value.closed) { stopped = true; clearInterval(timer); process.stdin.pause(); process.exitCode = 0; }
  } catch {
    if (!disconnected) process.stdout.write('\nObservation feed unavailable. The agent is unaffected.\n');
    disconnected = true;
  } finally { reading = false; }
};
let timer;
fs.writeFile(require('node:path').join(__dirname, 'observer.json'), JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 384 }).then(() => {
  timer = setInterval(() => { void observe(); }, 300);
  void observe();
}).catch(() => { process.exitCode = 1; });
`;
