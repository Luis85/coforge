import { record } from '../domain/check';

/** Codex strict output requires every property; represent original optional fields as nullable. */
export function codexOutputSchema(schema: object): object {
  const source = record(schema);
  const result: Record<string, unknown> = { ...source };
  if (!source.type && Array.isArray(source.enum)) {
    if (source.enum.every(value => typeof value === 'string')) result.type = 'string';
    else if (source.enum.every(value => typeof value === 'number')) result.type = 'number';
  }
  if (source.properties) {
    const properties = record(source.properties);
    const required = Array.isArray(source.required) ? source.required : [];
    result.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => {
      const converted = codexOutputSchema(record(value));
      return [key, required.includes(key) ? converted : { anyOf: [converted, { type: 'null' }] }];
    }));
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }
  if (source.items && typeof source.items === 'object' && !Array.isArray(source.items)) result.items = codexOutputSchema(source.items);
  for (const key of ['anyOf', 'oneOf', 'allOf']) if (Array.isArray(source[key])) result[key] = source[key].map(item => codexOutputSchema(record(item)));
  return result;
}
/** Restore only schema-optional nulls to omission. Unknown fields remain for host validators to reject. */
export function normalizeCodexOutput(value: unknown, schema: object): unknown {
  const source = record(schema);
  if (Array.isArray(value) && source.items) return value.map(item => normalizeCodexOutput(item, record(source.items)));
  if (!value || typeof value !== 'object' || Array.isArray(value) || !source.properties) return value;
  const properties = record(source.properties);
  const required = Array.isArray(source.required) ? source.required : [];
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => !(Object.hasOwn(properties, key) && item === null && !required.includes(key)))
    .map(([key, item]) => [key, Object.hasOwn(properties, key) ? normalizeCodexOutput(item, record(properties[key])) : item]));
}
