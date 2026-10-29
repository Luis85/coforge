import { vi } from 'vitest';
import { AlertsService } from '../../../features/coforge/application/alerts-service';
import type { AlertCue, AlertsDefinition, AlertTemplate } from '../../../features/coforge/domain/alerts';

export const welcomeAlert: AlertTemplate = { id: 'welcome', name: 'Welcome', text: 'Welcome {{viewer}}! {{count}}', image: '', audio: '', video: '', duration: 5, volume: 0.5, event: 'registered', enabled: true };
export function alertsFixture(initialSources = 1) {
  let saved: AlertsDefinition = { version: 1, templates: [] };
  let sources = initialSources;
  const listeners = new Set<(sources: number) => void>();
  const save = vi.fn(async (next: AlertsDefinition) => { saved = structuredClone(next); });
  const send = vi.fn((_cue: AlertCue) => sources);
  const clear = vi.fn(); const close = vi.fn(async () => {});
  const checkMedia = vi.fn(async (_paths: readonly string[]) => {});
  const transport = {
    start: async () => 'http://127.0.0.1:1234/alerts/token/', send, clear, close,
    subscribeSources(listener: (sources: number) => void) { listeners.add(listener); listener(sources); return () => { listeners.delete(listener); }; },
  };
  const storage = { load: async () => saved, save };
  const service = new AlertsService(storage, transport, { check: checkMedia });
  return { service, storage, transport, save, send, clear, close, checkMedia,
    sources(value: number) { sources = value; for (const listener of listeners) listener(sources); },
  };
}
