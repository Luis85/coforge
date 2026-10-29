import { boolean, oneOf, optional, shape, text } from './check';
export const OBS_OVERLAY_KINDS = ['request', 'increment', 'recognition', 'now-playing', 'council-excerpt'] as const;
export type ObsOverlayKind = typeof OBS_OVERLAY_KINDS[number];
export interface ObsOverlayDefinition {
  id: string; name: string; kind: ObsOverlayKind; inputId: string; projectId: string;
  subjectId?: string; excerpt?: string; publicConfirmed: boolean;
  publication?: ObsOverlayPublication;
}
export interface ObsOverlayPublication {
  status: 'publishing' | 'published' | 'revocation-required' | 'cleared' | 'uncertain';
  text: string; inputKind: string; pendingText?: string;
}
const publication = shape({ status: oneOf(['publishing', 'published', 'revocation-required', 'cleared', 'uncertain']),
  text: text({ max: 4000 }), inputKind: text({ min: 1, max: 100 }), pendingText: optional(text({ max: 4000 })) }, { strict: true });
export const obsOverlayDefinitionCheck = shape({
  id: text({ min: 1, max: 100, pattern: /^[a-zA-Z0-9_-]+$/ }), name: text({ trim: true, min: 1, max: 150 }), kind: oneOf(OBS_OVERLAY_KINDS),
  inputId: text({ min: 1, max: 300 }), projectId: text({ min: 1, max: 100 }),
  subjectId: optional(text({ min: 1, max: 300 })), excerpt: optional(text({ trim: true, min: 1, max: 2000 })), publicConfirmed: boolean,
  publication: optional(publication),
}, { strict: true });
export interface ObsOverlayChoice { id: string; name: string }
export interface ObsOverlayCandidates {
  projects: ObsOverlayChoice[]; requests: ObsOverlayChoice[]; increments: ObsOverlayChoice[];
  recognition: ObsOverlayChoice[]; inputs: ObsOverlayChoice[];
}
export interface ObsOverlayPreview {
  id: string; definition: ObsOverlayDefinition; text: string; inputName: string; shared: boolean; onAir: boolean;
  switchesFromFile: boolean;
}
export interface ObsOverlayNowPlaying { title: string; artist: string; attribution: string }
export const OBS_OVERLAY_OPERATION_CODES = ['obs-overlay-saved', 'obs-overlay-removed', 'obs-overlay-published', 'obs-overlay-revocation-required', 'obs-overlay-cleared'] as const;
