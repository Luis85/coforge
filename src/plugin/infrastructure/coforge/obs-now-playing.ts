import type { MusicActions } from '../../features/coforge/application/music-ports';
import type { ObsOverlayNowPlaying } from '../../features/coforge/domain/obs-overlay';

/** Only reviewed display metadata crosses into the public overlay renderer, never vault paths or playback internals. */
export function obsNowPlaying(music: Pick<MusicActions, 'snapshot'>): ObsOverlayNowPlaying | null {
  const state = music.snapshot();
  if (state.playback.phase !== 'playing') return null;
  const id = state.playback.queue[state.playback.index];
  const track = state.library.tracks.find(item => item.id === id);
  if (!track || !track.note) return null;
  return { title: track.title, artist: track.artist, attribution: track.attribution };
}
