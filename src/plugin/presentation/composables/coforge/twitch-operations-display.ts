import type { TwitchActionDescriptor, TwitchOperationField, TwitchParameters, TwitchValue } from '../../../features/coforge/domain/twitch-operations';
import type { ScheduledStream } from '../../../features/coforge/domain/schedule';

export function twitchFieldLabel(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, value => value.toUpperCase()).replace(/\bId\b/g, 'ID');
}

/** Render external values as bounded text, never HTML or executable Markdown. */
export function twitchDisplayValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value).slice(0, 1200);
  if (depth > 2) return 'Additional nested information';
  if (Array.isArray(value)) return value.map(item => twitchDisplayValue(item, depth + 1)).join(' · ').slice(0, 1200) || 'None';
  if (typeof value === 'object') return Object.entries(value).map(([key, entry]) => `${twitchFieldLabel(key)}: ${twitchDisplayValue(entry, depth + 1)}`).join(' · ').slice(0, 1200);
  return 'Not provided';
}

export function twitchDraft(descriptor: TwitchActionDescriptor): Record<string, string | number> {
  return Object.fromEntries(descriptor.fields.map(field => [field.name, field.type === 'boolean' ? '' : field.type === 'select' && field.required ? field.options?.[0] ?? '' : '']));
}

export function twitchActionParameters(fields: readonly TwitchOperationField[], draft: Record<string, TwitchValue>): TwitchParameters {
  const parameters: TwitchParameters = {};
  for (const field of fields) {
    const value = draft[field.name];
    if (value === '' || value === undefined) continue;
    if (field.type === 'number') parameters[field.name] = Number(value);
    else if (field.type === 'list') parameters[field.name] = String(value).split('\n').map(line => line.trim()).filter(Boolean);
    else if (field.type === 'boolean') parameters[field.name] = value === true || value === 'true';
    else parameters[field.name] = typeof value === 'string' ? value.trim() : value;
  }
  return parameters;
}

export function twitchRecordFields(record: Record<string, unknown>) {
  return Object.entries(record).map(([key, value]) => ({ key, label: twitchFieldLabel(key), value: twitchDisplayValue(value) }));
}

/** Only the authored public title and schedule fields may enter a publication draft. */
export function twitchPublicPlanDraft(plan: ScheduledStream): Record<string, string | number> {
  return { title: plan.title, start_time: plan.startsAt, timezone: plan.timezone, category_id: plan.categoryId, duration: 120, is_recurring: 'false' };
}
