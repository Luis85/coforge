import { expect, it } from 'vitest';
import { AlertsService } from '../../../features/coforge/application/alerts-service';
import { alertsFixture, welcomeAlert as template } from './alert-test-fixture';

it('ALERTS-01 saves reusable templates, substitutes literal variables, and reports prepared source delivery', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  await expect(f.service.fire('welcome', { viewer: '<img src=x onerror=alert(1)>', count: '2' })).resolves.toEqual({ sources: 1 });
  expect(f.send).toHaveBeenCalledWith({ text: 'Welcome <img src=x onerror=alert(1)>! 2', image: '', audio: '', video: '', duration: 5, volume: 0.5 });
  expect(f.service.snapshot()).toMatchObject({ url: expect.stringContaining('/alerts/'), sources: 1 });
  await f.service.dispose(); expect(f.close).toHaveBeenCalledOnce();
});

it('ALERTS-02 binds enabled templates to new event identities, deduplicates, and does not replay disconnected events', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  await f.service.event('registered', '1', { viewer: 'Ada', count: '1' });
  await f.service.event('registered', '1', { viewer: 'Ada', count: '1' });
  await f.service.event('vote-counted', '2', { viewer: 'Ada' });
  expect(f.send).toHaveBeenCalledTimes(1);
  f.sources(0); await f.service.event('registered', 'missed', { viewer: 'Ben', count: '1' });
  f.sources(1); await f.service.event('registered', 'missed', { viewer: 'Ben', count: '1' });
  expect(f.send).toHaveBeenCalledTimes(1);
  await f.service.save({ ...template, enabled: false });
  await f.service.event('registered', '3', { viewer: 'Ben', count: '1' });
  expect(f.send).toHaveBeenCalledTimes(1); await f.service.dispose();
});

it('ALERTS-03 keeps the saved definition after failure and rejects unsafe media, unknown variables and invalid limits', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  f.save.mockRejectedValueOnce(new Error('Disk full'));
  await expect(f.service.save({ ...template, text: 'Changed' })).rejects.toThrow('Disk full');
  expect(f.service.snapshot().templates[0]?.text).toBe(template.text);
  await expect(f.service.fire('welcome', {})).rejects.toThrow('viewer');
  for (const image of ['../private.png', 'javascript:alert(1)', '/absolute.png', 'CoForge/.obsidian/private.png', 'clip.mp4'])
    await expect(f.service.save({ ...template, image })).rejects.toThrow();
  for (const duration of [0, 121, Number.NaN]) await expect(f.service.save({ ...template, duration })).rejects.toThrow();
  for (const volume of [-0.1, 1.1, Number.NaN]) await expect(f.service.save({ ...template, volume })).rejects.toThrow();
  await expect(f.service.save({ ...template, text: '{{viewer.name}}' })).rejects.toThrow();
  await expect(f.service.save({ ...template, event: 'stream-started', text: 'Hello {{viewer}}' })).rejects.toThrow();
  expect(f.send).not.toHaveBeenCalled(); await f.service.dispose();
});

it('reports zero sources, checks live media before dispatch and cancels pending delivery on Stop', async () => {
  const f = alertsFixture(0); await f.service.start(); await f.service.save(template);
  await expect(f.service.fire('welcome', { viewer: 'Ada', count: '1' })).rejects.toThrow();
  expect(f.service.snapshot().sources).toBe(0); expect(f.send).not.toHaveBeenCalled();
  f.sources(2); expect(f.service.snapshot().sources).toBe(2);
  await f.service.save({ ...template, audio: 'Alerts/chime.mp3' });
  f.checkMedia.mockRejectedValueOnce(new Error('Selected media is missing'));
  await expect(f.service.fire('welcome', { viewer: 'Ada', count: '1' })).rejects.toThrow('missing');
  expect(f.send).not.toHaveBeenCalled();
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  f.checkMedia.mockImplementationOnce(async () => { await gate; });
  const dispatch = f.service.fire('welcome', { viewer: 'Ada', count: '1' });
  await Promise.resolve(); f.service.clear(); release();
  await expect(dispatch).rejects.toThrow(); expect(f.send).not.toHaveBeenCalled();
  await expect(f.service.fire('welcome', { viewer: 'Ada', count: '1' })).resolves.toEqual({ sources: 2 });
  expect(f.checkMedia).toHaveBeenLastCalledWith(['Alerts/chime.mp3']); await f.service.dispose();
});

it('preserves playback while editing an unrelated template and clears revoked media on removal', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  const other = { ...template, id: 'other', name: 'Other', image: 'Alerts/party.gif' };
  await f.service.save(other); f.clear.mockClear();
  await f.service.fire('welcome', { viewer: 'Ada', count: '1' });
  await f.service.save({ ...other, name: 'Other renamed' }); expect(f.clear).not.toHaveBeenCalled();
  await f.service.remove('other'); expect(f.clear).toHaveBeenCalledOnce();
  await f.service.dispose();
});

it('keeps invocation order through asynchronous media preflight and prevents later queued alerts after Stop', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  f.checkMedia.mockImplementationOnce(async () => { await gate; });
  const first = f.service.fire('welcome', { viewer: 'First', count: '1' });
  const second = f.service.fire('welcome', { viewer: 'Second', count: '2' });
  await Promise.resolve(); expect(f.send).not.toHaveBeenCalled(); release(); await Promise.all([first, second]);
  expect(f.send.mock.calls.map(([cue]) => cue.text)).toEqual(['Welcome First! 1', 'Welcome Second! 2']);
  f.send.mockClear();
  let resume = () => {}; const stopGate = new Promise<void>(resolve => { resume = resolve; });
  f.checkMedia.mockImplementationOnce(async () => { await stopGate; });
  const active = f.service.fire('welcome', { viewer: 'Active', count: '1' });
  const waiting = f.service.fire('welcome', { viewer: 'Queued', count: '2' });
  await Promise.resolve(); f.service.clear(); resume();
  expect((await Promise.allSettled([active, waiting])).every(result => result.status === 'rejected')).toBe(true);
  expect(f.send).not.toHaveBeenCalled(); await f.service.dispose();
});

it('does not deliver a pending cue to a source that reconnects after its original source disconnected', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  f.checkMedia.mockImplementationOnce(async () => { await gate; });
  const pending = f.service.fire('welcome', { viewer: 'Old connection', count: '1' });
  await Promise.resolve(); f.sources(0); f.sources(1); release();
  await expect(pending).rejects.toThrow(); expect(f.send).not.toHaveBeenCalled();
  await expect(f.service.fire('welcome', { viewer: 'Fresh connection', count: '1' })).resolves.toEqual({ sources: 1 });
  expect(f.send).toHaveBeenCalledOnce(); await f.service.dispose();
});

it('bounds pending media admissions and clears every bound template during an automatic dispatch preflight', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template);
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  f.checkMedia.mockImplementationOnce(async () => { await gate; });
  const pending = Array.from({ length: 20 }, (_, index) => f.service.fire('welcome', { viewer: `Queued ${index}`, count: '1' }));
  const settled = Promise.allSettled(pending);
  await expect(f.service.fire('welcome', { viewer: 'Overflow', count: '1' })).rejects.toThrow('queue');
  f.service.clear(); release(); expect((await settled).every(result => result.status === 'rejected')).toBe(true);
  await f.service.save({ ...template, id: 'second', name: 'Second binding' });
  let resume = () => {}; const automaticGate = new Promise<void>(resolve => { resume = resolve; });
  f.checkMedia.mockImplementationOnce(async () => { await automaticGate; });
  const automatic = f.service.event('registered', 'automatic-pending', { viewer: 'Ada', count: '1' });
  await Promise.resolve(); f.service.clear(); resume(); await automatic;
  expect(f.send).not.toHaveBeenCalled(); expect(f.service.snapshot().error).toBe(''); await f.service.dispose();
});

it('closes a source that finishes starting during unload and isolates failing view observers', async () => {
  const f = alertsFixture();
  let release = () => {}; let entered = () => {};
  const wait = new Promise<void>(resolve => { release = resolve; });
  const starting = new Promise<void>(resolve => { entered = resolve; });
  const service = new AlertsService(f.storage, { ...f.transport, start: async () => { entered(); await wait; return 'http://127.0.0.1:1234/'; } });
  const open = service.start(); await starting;
  const closing = service.dispose(); release(); await Promise.all([open, closing]);
  expect(f.close).toHaveBeenCalled(); expect(service.snapshot().ready).toBe(false);
  await f.service.start();
  f.service.subscribe(() => { throw new Error('View disconnected'); });
  await expect(f.service.save(template)).resolves.toBeUndefined(); expect(f.service.snapshot().templates).toHaveLength(1);
  await f.service.dispose();
});

it('keeps saved templates visible when source startup fails and does not pretend the endpoint is ready', async () => {
  const f = alertsFixture(); await f.service.start(); await f.service.save(template); await f.service.dispose();
  const failed = new AlertsService(f.storage, { ...f.transport, start: async () => { throw new Error('Saved local port is occupied'); } });
  await expect(failed.start()).rejects.toThrow('occupied');
  expect(failed.snapshot()).toMatchObject({ ready: false, url: '', templates: [template], error: expect.stringContaining('occupied') });
  await expect(failed.fire('welcome', { viewer: 'Ada', count: '1' })).rejects.toThrow();
  await failed.dispose();
});
