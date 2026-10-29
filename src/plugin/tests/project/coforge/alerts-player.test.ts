// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { alertsPlayer } from '../../../infrastructure/coforge/alerts-player';

function fixture() {
  vi.useFakeTimers();
  const handlers = new Map<string, (event: { data: string }) => void>();
  let disconnect = () => {};
  class Source {
    onerror: (() => void) | null = null;
    constructor() { disconnect = () => { this.onerror?.(); }; }
    addEventListener(type: string, callback: (event: { data: string }) => void) { handlers.set(type, callback); }
    close() {}
  }
  vi.stubGlobal('EventSource', Source);
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  document.body.innerHTML = '<main id="alert"></main>';
  alertsPlayer();
  return {
    play, pause, load, disconnect: () => disconnect(),
    send: (text: string, media: { image?: string; audio?: string; video?: string } = {}) => handlers.get('cue')?.({ data: JSON.stringify({ text, image: '', audio: '', video: '', duration: 2, volume: 0.4, ...media }) }),
    clear: () => handlers.get('clear')?.({ data: '{}' }),
    text: () => document.querySelector('#alert')?.textContent,
    dispose() { window.dispatchEvent(new Event('pagehide')); document.body.replaceChildren(); play.mockRestore(); pause.mockRestore(); load.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers(); },
  };
}

it('queues literal cues, stops audio/video at duration and clears active and waiting playback on disconnect and stop', () => {
  const f = fixture();
  try {
    f.send('<b>Ada</b>', { audio: 'media/sound.mp3', video: 'media/clip.webm' }); f.send('Second');
    expect(f.text()).toBe('<b>Ada</b>'); expect(document.querySelector('#alert b')).toBeNull(); expect(f.play).toHaveBeenCalledTimes(2);
    expect(document.querySelector('audio')?.volume).toBe(0.4); expect(document.querySelector('video')?.volume).toBe(0.4);
    vi.advanceTimersByTime(2000); expect(f.text()).toBe('Second'); expect(f.pause).toHaveBeenCalledTimes(2);
    f.send('Queued behind second'); f.disconnect(); expect(f.text()).toBe('');
    vi.advanceTimersByTime(20_000); expect(f.text()).toBe('');
    f.send('New live cue'); f.send('Also waiting'); f.clear(); expect(f.text()).toBe('');
    vi.advanceTimersByTime(20_000); expect(f.text()).toBe('');
  } finally { f.dispose(); }
});

it('bounds the queue at twenty waiting alerts and drops overflow without disturbing admitted cue order', () => {
  const f = fixture();
  try {
    f.send('Active');
    for (let index = 1; index <= 20; index++) f.send(`Waiting ${index}`);
    f.send('Overflow must be discarded');
    expect(f.text()).toBe('Active');
    for (let index = 1; index <= 20; index++) { vi.advanceTimersByTime(2000); expect(f.text()).toBe(`Waiting ${index}`); }
    vi.advanceTimersByTime(2000); expect(f.text()).toBe('');
  } finally { f.dispose(); }
});

it('contains media playback rejection while preserving visible text and later alerts', async () => {
  const f = fixture(); f.play.mockRejectedValueOnce(new Error('Autoplay unavailable'));
  try {
    f.send('Text is still visible', { audio: 'media/sound.mp3' }); f.send('Next alert');
    await Promise.resolve(); expect(f.text()).toBe('Text is still visible');
    expect(document.querySelector('.cue')?.getAttribute('data-audio')).toBe('blocked');
    vi.advanceTimersByTime(2000); expect(f.text()).toBe('Next alert');
  } finally { f.dispose(); }
});
