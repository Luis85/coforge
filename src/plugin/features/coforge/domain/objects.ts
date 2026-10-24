/** A shallow copy without the named keys. */
export function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

/** The note-owned part of an idea: votes and increments live in plugin data. */
export const noteOnly = <T extends { voters: unknown; increment?: unknown }>(idea: T): Omit<T, 'voters' | 'increment'> => omit(idea, 'voters', 'increment');
