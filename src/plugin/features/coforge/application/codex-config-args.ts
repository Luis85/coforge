/** TOML inline tables use JSON-compatible string quoting and never shell interpolation. */
function toml(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) return `{ ${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)} = ${toml(item)}`).join(', ')} }`;
  return JSON.stringify(value);
}
export function codexConfigArgs(config: Record<string, unknown>): string[] {
  return Object.entries(config).flatMap(([key, value]) => ['--config', `${key}=${toml(value)}`]);
}
