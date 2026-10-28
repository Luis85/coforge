import { defangProperty } from './sanitize';

/** Transform validated managed data without normalizing captured artifact bytes or their hashes. */
function mapStrings(value: unknown, transform: (text: string) => string): unknown {
  let remaining = 100000;
  const seen = new Set<object>();
  function visit(item: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 60) throw new Error('The managed workflow note exceeds its structural limit.');
    if (typeof item === 'string') return transform(item);
    if (item === null || typeof item !== 'object') return item;
    if (seen.has(item)) throw new Error('Managed workflow notes cannot contain cyclic data.');
    seen.add(item);
    const result = Array.isArray(item) ? item.map(entry => visit(entry, depth + 1))
      : Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, visit(entry, depth + 1)]));
    seen.delete(item);
    return result;
  }
  return visit(value, 0);
}
// Doubling original joiners keeps this reversible even when captured text already contains one.
export const workflowNoteData = (value: unknown): unknown => mapStrings(value, text => defangProperty(text.replaceAll('\u2060', '\u2060\u2060')));
export const restoreWorkflowNoteData = (value: unknown): unknown => mapStrings(value, text => text.replace(/\u2060+/gu, run => '\u2060'.repeat(Math.floor(run.length / 2))));
