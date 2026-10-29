import { boolean, list, number, oneOf, shape, text } from './check';
import type { OperationCode } from './population';
const eventFields = ['event', 'count'] as const;
const viewerFields = [...eventFields, 'viewer'] as const;
const requestFields = [...viewerFields, 'request', 'title', 'project'] as const;
/** Possible fields, not a promise that optional viewer/screened-request context is present. */
export const ALERT_EVENT_DEFINITIONS = [
  { id: 'registered', label: 'Viewer registered', variables: viewerFields },
  { id: 'request-created', label: 'Request submitted', variables: viewerFields },
  { id: 'bug-created', label: 'Bug reported', variables: viewerFields },
  { id: 'vote-counted', label: 'Vote counted', variables: requestFields },
  { id: 'job-completed', label: 'Agent task completed', variables: requestFields },
  { id: 'workflow-run-finished', label: 'Workflow finished', variables: requestFields },
  { id: 'workflow-run-awaiting-review', label: 'Workflow ready for review', variables: requestFields },
  { id: 'stream-started', label: 'Stream started', variables: eventFields },
  { id: 'stream-paused', label: 'Stream paused', variables: eventFields },
  { id: 'stream-resumed', label: 'Stream resumed', variables: eventFields },
  { id: 'stream-stopped', label: 'Stream stopped', variables: eventFields },
  { id: 'obs-stream-state-changed', label: 'OBS stream state changed', variables: eventFields },
  { id: 'obs-scene-changed', label: 'OBS scene changed', variables: eventFields },
] as const satisfies readonly { id: OperationCode; label: string; variables: readonly string[] }[];
export const ALERT_EVENTS = ALERT_EVENT_DEFINITIONS.map(event => event.id);
export const alertEventVariables = (event: OperationCode | ''): readonly string[] => ALERT_EVENT_DEFINITIONS.find(item => item.id === event)?.variables ?? [];

export interface AlertTemplate {
  id: string; name: string; text: string; image: string; audio: string; video: string;
  duration: number; volume: number; event: OperationCode | ''; enabled: boolean;
}
export type AlertCue = Pick<AlertTemplate, 'text' | 'image' | 'audio' | 'video' | 'duration' | 'volume'>;
export interface AlertsDefinition { version: 1; templates: AlertTemplate[] }
export interface AlertsSnapshot extends AlertsDefinition { ready: boolean; url: string; error: string; sources: number }
export class AlertDispatchError extends Error {
  constructor(readonly kind: 'source' | 'variables' | 'media' | 'queue' | 'cancelled', message: string) { super(message); this.name = 'AlertDispatchError'; }
}
const identifier = text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9_-]+$/ });
export const ALERT_MEDIA = {
  gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm',
};
export function alertMediaType(path: string): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase();
  return Object.entries(ALERT_MEDIA).find(([key]) => key === extension)?.[1];
}
function media(value: unknown): string {
  const path = text({ max: 500, trim: true })(value);
  if (!path) return '';
  if (path.includes('\\') || path.includes(':') || path.includes('?') || path.includes('#') || path.includes('%') || path.startsWith('/') || path.split('/').some(part => !part || part.startsWith('.')) || !alertMediaType(path))
    throw new Error('Select a GIF, image, audio or video file inside the vault using a relative path.');
  return path;
}
const checkedTemplate = shape({ id: identifier, name: text({ min: 1, max: 100, trim: true }), text: text({ max: 2000 }), image: media, audio: media, video: media,
  duration: number({ min: 1, max: 120 }), volume: number({ min: 0, max: 1 }), event: oneOf(['', ...ALERT_EVENTS]), enabled: boolean }, { strict: true });
export function alertTemplateCheck(input: unknown): AlertTemplate {
  const template = checkedTemplate(input);
  for (const [field, prefix] of [['image', 'image/'], ['audio', 'audio/'], ['video', 'video/']] as const) {
    if (template[field] && !alertMediaType(template[field])?.startsWith(prefix)) throw new Error(`Choose a supported ${field} file.`);
  }
  if (!template.text.trim() && !template.image && !template.audio && !template.video) throw new Error('Add alert text or a media file.');
  // No expressions or dynamic property access: a template contains only named literal slots.
  const remainder = template.text.replace(/\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/g, '');
  if (remainder.includes('{{') || remainder.includes('}}')) throw new Error('Use simple variables such as {{viewer}}.');
  if (template.enabled) {
    if (!template.event) throw new Error('Choose an automatic event or disable automatic dispatch.');
    const available = alertEventVariables(template.event);
    const unavailable = alertVariables(template.text).filter(key => !available.includes(key));
    if (unavailable.length) throw new Error(`This automatic event cannot supply: ${unavailable.join(', ')}. Available variables: ${available.join(', ')}. Choose another event or disable automatic dispatch.`);
  }
  return template;
}
export function alertsDefinitionCheck(input: unknown): AlertsDefinition {
  const result = shape({ version: oneOf([1]), templates: list(alertTemplateCheck, { max: 100 }) }, { strict: true })(input);
  if (new Set(result.templates.map(item => item.id)).size !== result.templates.length) throw new Error('Alert IDs must be unique.');
  return result;
}
export const alertVariables = (text: string): string[] => [...new Set([...text.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)].flatMap(match => match[1] ? [match[1]] : []))];
export function renderAlert(template: AlertTemplate, variables: Record<string, string>): AlertCue {
  const rendered = template.text.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_slot, key: string) => {
    if (!Object.hasOwn(variables, key) || typeof variables[key] !== 'string') throw new Error(`Supply the ${key} variable before firing this alert.`);
    return text({ max: 500 })(variables[key]);
  });
  if (rendered.length > 4000) throw new Error('The rendered alert is too long. Shorten the text or variables.');
  return { text: rendered, image: template.image, audio: template.audio, video: template.video, duration: template.duration, volume: template.volume };
}
