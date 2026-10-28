import { list, number, oneOf, record, shape, text, timestamp } from './check';

export type TaskTiming = { kind: 'once'; at: string } | { kind: 'interval'; startsAt: string; everySeconds: number }
  | { kind: 'calendar'; time: string; timeZone: string; weekdays: number[] };
const once = shape({ kind: oneOf(['once'] as const), at: timestamp }, { strict: true });
const interval = shape({ kind: oneOf(['interval'] as const), startsAt: timestamp, everySeconds: number({ integer: true, min: 1, max: 31536000 }) }, { strict: true });
const calendar = shape({ kind: oneOf(['calendar'] as const), time: text({ pattern: /^(?:[01]\d|2[0-3]):[0-5]\d$/u }),
  timeZone: text({ min: 1, max: 100 }), weekdays: list(number({ integer: true, min: 0, max: 6 }), { min: 1, max: 7 }) }, { strict: true });
function formatter(zone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
export function taskTimingCheck(value: unknown): TaskTiming {
  const kind = record(value).kind;
  if (kind === 'once') return once(value);
  if (kind === 'interval') return interval(value);
  const checked = calendar(value);
  if (new Set(checked.weekdays).size !== checked.weekdays.length) throw new Error('Select each weekday once.');
  try { formatter(checked.timeZone); } catch { throw new Error('Choose a valid IANA timezone, such as Europe/Berlin.'); }
  return checked;
}
interface WallTime { year: number; month: number; day: number; hour: number; minute: number }
function wall(format: Intl.DateTimeFormat, at: number): WallTime {
  const parts = format.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}
const utc = (value: WallTime) => Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute);
/** Explicit wall-clock mapping: absent DST times are skipped; repeated times use their first occurrence only. */
export function nextTaskTime(input: TaskTiming, after: number): number | null {
  const timing = taskTimingCheck(input);
  if (!Number.isFinite(after)) throw new Error('The scheduler clock is invalid.');
  if (timing.kind === 'once') { const at = Date.parse(timing.at); return at > after ? at : null; }
  if (timing.kind === 'interval') {
    const anchor = Date.parse(timing.startsAt);
    return anchor > after ? anchor : anchor + (Math.floor((after - anchor) / (timing.everySeconds * 1000)) + 1) * timing.everySeconds * 1000;
  }
  const format = formatter(timing.timeZone);
  const today = wall(format, after);
  const [hour = 0, minute = 0] = timing.time.split(':').map(Number);
  for (let day = 0; day <= 15; day++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + day));
    if (!timing.weekdays.includes(date.getUTCDay())) continue;
    const desired = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour, minute };
    const nominal = utc(desired);
    const offsets = new Set([-36, 0, 36].map(hours => { const sample = nominal + hours * 3600000; return utc(wall(format, sample)) - sample; }));
    const matches = [...offsets].map(offset => nominal - offset).filter(at => utc(wall(format, at)) === nominal).sort((a, b) => a - b);
    const first = matches[0];
    if (first !== undefined && first > after) return first;
  }
  throw new Error('The next calendar occurrence could not be resolved. Review its timezone and weekdays.');
}
