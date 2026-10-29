import { describe, expect, it } from 'vitest';
import { twitchContentUrl } from '../../../presentation/composables/coforge/use-twitch-operations-polish';

describe('Twitch content links', () => {
  it('accepts only HTTPS content URLs on Twitch hosts', () => {
    expect(twitchContentUrl('https://clips.twitch.tv/Example/edit')).toBe('https://clips.twitch.tv/Example/edit');
    expect(twitchContentUrl('https://www.twitch.tv/videos/123')).toBe('https://www.twitch.tv/videos/123');
    for (const value of ['javascript:alert(1)', 'http://clips.twitch.tv/Example', 'https://clips.twitch.tv.evil.example/Example', 'https://evil.example/?twitch.tv', 'https://attacker@clips.twitch.tv/Example', '//clips.twitch.tv/Example', 'not a URL']) {
      expect(twitchContentUrl(value)).toBeUndefined();
    }
  });
});
