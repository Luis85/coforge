import { expect, it } from 'vitest';
import { emptyMusic } from '../../../features/coforge/domain/music';
import { obsNowPlaying } from '../../../infrastructure/coforge/obs-now-playing';

it('projects only companion-note display metadata from the current playing track', () => {
  const state = emptyMusic();
  state.library.folder = 'Private/Music';
  state.library.tracks = [{ id: 'Private/Music/secret-file.mp3', title: 'Evening light', artist: 'Studio artist', attribution: 'Music credit', license: 'Owner reviewed', origin: 'private-origin', note: true }];
  state.playback.queue = ['Private/Music/secret-file.mp3'];
  state.playback.phase = 'playing';
  const source = { snapshot: () => state };
  expect(obsNowPlaying(source)).toEqual({ title: 'Evening light', artist: 'Studio artist', attribution: 'Music credit' });
  expect(JSON.stringify(obsNowPlaying(source))).not.toMatch(/Private|secret-file|private-origin/);
  state.playback.phase = 'paused';
  expect(obsNowPlaying(source)).toBeNull();
  state.playback.phase = 'playing';
  state.library.tracks[0]!.note = false;
  expect(obsNowPlaying(source)).toBeNull();
});
