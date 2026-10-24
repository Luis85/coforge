/** Small runtime validators for untrusted boundaries (persisted state, agent output, form input). */
export class CheckError extends Error {
  constructor(readonly path: string, message: string) { super(`${path || 'value'}: ${message}`); this.name = 'CheckError'; }
}
export type Check<T> = (value: unknown, path?: string) => T;

export const record = (value: unknown, path = ''): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CheckError(path, 'expected an object');
  return value as Record<string, unknown>;
};

export function text(options: { min?: number; max?: number; trim?: boolean; pattern?: RegExp } = {}): Check<string> {
  return (value, path = '') => {
    if (typeof value !== 'string') throw new CheckError(path, 'expected text');
    const result = options.trim ? value.trim() : value;
    if (options.min !== undefined && result.length < options.min) throw new CheckError(path, `needs at least ${options.min} characters`);
    if (options.max !== undefined && result.length > options.max) throw new CheckError(path, `allows at most ${options.max} characters`);
    if (options.pattern && !options.pattern.test(result)) throw new CheckError(path, 'has an invalid format');
    return result;
  };
}

export function number(options: { min?: number; max?: number; integer?: boolean; gt?: number } = {}): Check<number> {
  return (value, path = '') => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new CheckError(path, 'expected a number');
    if (options.integer && !Number.isInteger(value)) throw new CheckError(path, 'expected a whole number');
    if (options.gt !== undefined && value <= options.gt) throw new CheckError(path, `must be greater than ${options.gt}`);
    if (options.min !== undefined && value < options.min) throw new CheckError(path, `must be at least ${options.min}`);
    if (options.max !== undefined && value > options.max) throw new CheckError(path, `must be at most ${options.max}`);
    return value;
  };
}

export const boolean: Check<boolean> = (value, path = '') => {
  if (typeof value !== 'boolean') throw new CheckError(path, 'expected true or false');
  return value;
};

export function oneOf<const T extends string | number>(values: readonly T[]): Check<T> {
  return (value, path = '') => {
    if (!values.includes(value as T)) throw new CheckError(path, `expected one of ${values.join(', ')}`);
    return value as T;
  };
}

export const timestamp: Check<string> = (value, path = '') => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new CheckError(path, 'expected a timestamp');
  return value;
};

/** Note properties may come back from a YAML parser as Date objects; they are normalized to ISO text. */
export const noteTimestamp: Check<string> = (value, path = '') =>
  value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : timestamp(value, path);

export function list<T>(item: Check<T>, options: { min?: number; max?: number } = {}): Check<T[]> {
  return (value, path = '') => {
    if (!Array.isArray(value)) throw new CheckError(path, 'expected a list');
    if (options.min !== undefined && value.length < options.min) throw new CheckError(path, `needs at least ${options.min} entries`);
    if (options.max !== undefined && value.length > options.max) throw new CheckError(path, `allows at most ${options.max} entries`);
    return value.map((entry, index) => item(entry, `${path}[${index}]`));
  };
}

export const optional = <T>(check: Check<T>): Check<T | undefined> => (value, path) => value === undefined ? undefined : check(value, path);
export const nullable = <T>(check: Check<T>): Check<T | null> => (value, path) => value === null ? null : check(value, path);

type Shape = Record<string, Check<unknown>>;
type Parsed<S extends Shape> = { [K in keyof S as undefined extends ReturnType<S[K]> ? never : K]: ReturnType<S[K]> }
  & { [K in keyof S as undefined extends ReturnType<S[K]> ? K : never]?: Exclude<ReturnType<S[K]>, undefined> };

/** Validates an object shape; `strict` rejects unknown keys (agent output and settings patches). */
export function shape<S extends Shape>(fields: S, options: { strict?: boolean } = {}): Check<Parsed<S>> {
  return (value, path = '') => {
    const input = record(value, path);
    if (options.strict) for (const key of Object.keys(input)) if (!(key in fields)) throw new CheckError(path ? `${path}.${key}` : key, 'is not allowed');
    const output: Record<string, unknown> = {};
    for (const [key, check] of Object.entries(fields)) {
      const parsed = check(input[key], path ? `${path}.${key}` : key);
      if (parsed !== undefined) output[key] = parsed;
    }
    return output as Parsed<S>;
  };
}
