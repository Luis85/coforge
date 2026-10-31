export function buildDuration(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  if (value >= 3600)
    return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
  if (value >= 60) return `${Math.floor(value / 60)}m ${value % 60}s`;
  return `${value}s`;
}
