import { expect, it } from 'vitest';
import { nextTaskTime, taskTimingCheck } from '../../../features/coforge/domain/task-timing';

const time = (value: string) => Date.parse(value);
it('calculates one-time and anchored intervals strictly after the supplied instant without replaying gaps', () => {
  const at = '2026-10-28T10:00:00.000Z';
  expect(nextTaskTime({ kind: 'once', at }, time('2026-10-28T09:00:00Z'))).toBe(time(at));
  expect(nextTaskTime({ kind: 'once', at }, time(at))).toBeNull();
  expect(nextTaskTime({ kind: 'interval', startsAt: at, everySeconds: 60 }, time('2026-10-28T10:09:40Z'))).toBe(time('2026-10-28T10:10:00Z'));
});
it('resolves daily/weekly wall-clock schedules in their saved timezone', () => {
  expect(nextTaskTime({ kind: 'calendar', time: '09:30', timeZone: 'Europe/Berlin', weekdays: [1, 2, 3, 4, 5] }, time('2026-10-30T10:00:00Z'))).toBe(time('2026-11-02T08:30:00Z'));
  expect(nextTaskTime({ kind: 'calendar', time: '09:30', timeZone: 'America/New_York', weekdays: [0, 1, 2, 3, 4, 5, 6] }, time('2026-10-28T00:00:00Z'))).toBe(time('2026-10-28T13:30:00Z'));
});
it('skips nonexistent spring times and executes a repeated fall wall-clock time only once', () => {
  const daily = { kind: 'calendar' as const, time: '02:30', timeZone: 'Europe/Berlin', weekdays: [0, 1, 2, 3, 4, 5, 6] };
  expect(nextTaskTime(daily, time('2026-03-28T23:00:00Z'))).toBe(time('2026-03-30T00:30:00Z'));
  expect(nextTaskTime(daily, time('2026-10-24T23:00:00Z'))).toBe(time('2026-10-25T00:30:00Z'));
  expect(nextTaskTime(daily, time('2026-10-25T00:45:00Z'))).toBe(time('2026-10-26T01:30:00Z'));
  expect(nextTaskTime({ ...daily, weekdays: [0] }, time('2026-03-23T00:00:00Z'))).toBe(time('2026-04-05T00:30:00Z'));
});
it('rejects invalid zones, empty/duplicate weekdays and unsafe timer intervals', () => {
  for (const value of [
    { kind: 'calendar', time: '25:00', timeZone: 'Europe/Berlin', weekdays: [1] },
    { kind: 'calendar', time: '09:00', timeZone: 'Not/AZone', weekdays: [1] },
    { kind: 'calendar', time: '09:00', timeZone: 'UTC', weekdays: [] },
    { kind: 'calendar', time: '09:00', timeZone: 'UTC', weekdays: [1, 1] },
    { kind: 'interval', startsAt: 'invalid', everySeconds: 60 },
    { kind: 'interval', startsAt: '2026-10-28T10:00:00Z', everySeconds: 0 },
  ]) expect(() => taskTimingCheck(value)).toThrow();
});
