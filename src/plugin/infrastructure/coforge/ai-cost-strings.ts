/** Nested captured names use the same frontmatter escaping as the ledger's top-level text. */
export function mapCostStrings(value: unknown, transform: (text: string) => string): unknown {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map(item => mapCostStrings(item, transform));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapCostStrings(item, transform)]));
  return value;
}
