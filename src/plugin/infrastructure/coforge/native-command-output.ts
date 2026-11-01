import { normalizeSessionText } from './provider-session-safety';

/** A small human-readable preview is not a second SDK transcript. Structured transport-looking output is omitted. */
export function nativeCommandOutput(value: string): string {
  const lines: string[] = [];
  for (const line of normalizeSessionText(value).split('\n')) {
    const start = line.trimStart();
    if (start.startsWith('{') || start === '[' || start.startsWith('[{')) { lines.push('[Structured command output omitted from this bounded preview.]'); break; }
    lines.push(line);
  }
  return lines.join('\n');
}
