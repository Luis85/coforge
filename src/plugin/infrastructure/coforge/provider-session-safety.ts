import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';
import { cleanText } from '../../features/coforge/domain/sanitize';

export const sessionObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
export const sessionId = (value: unknown): string | undefined => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/u.test(value) ? value : undefined;
export const sessionStatus = (value: unknown): AgentSessionEvent['status'] => value === 'running' || value === 'completed' || value === 'failed' || value === 'queued' ? value : 'unknown';

function visibleText(value: string): string {
  let result = '', mode: 'text' | 'escape' | 'csi' | 'osc' | 'osc-escape' = 'text';
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (mode === 'escape') { mode = character === '[' ? 'csi' : character === ']' ? 'osc' : 'text'; continue; }
    if (mode === 'csi') { if (code >= 64 && code <= 126) mode = 'text'; continue; }
    if (mode === 'osc' || mode === 'osc-escape') { mode = code === 7 || mode === 'osc-escape' && character === '\\' ? 'text' : code === 27 ? 'osc-escape' : 'osc'; continue; }
    if (code === 27) { mode = 'escape'; continue; }
    if (code < 32 && code !== 9 && code !== 10 || code >= 127 && code <= 159 || code >= 8234 && code <= 8238 || code >= 8294 && code <= 8297) continue;
    result += character;
  }
  return result;
}

/** Sanitize a complete text observation before any display chunking. Never use this on arbitrary transport payloads. */
export function sessionTextSanitizer(environment: NodeJS.ProcessEnv = {}, paths: readonly string[] = []): (value: string, max?: number) => string {
  const secrets = [...new Set(Object.entries({ ...process.env, ...environment }).filter(([key, value]) => value && value.length >= 4 && /TOKEN|SECRET|API_KEY|PASSWORD|AUTHORIZATION/iu.test(key))
    .flatMap(([, value]) => [value!, cleanText(visibleText(value!))]).filter(Boolean))].sort((a, b) => b.length - a.length);
  return (value: string, max = 2048): string => {
    let text = cleanText(visibleText(value));
    for (const secret of secrets) text = text.split(secret).join('[redacted]');
    text = text.replace(/sk-[A-Za-z0-9_-]{8,}/gu, '[redacted]').replace(/Bearer\s+\S+/giu, 'Bearer [redacted]');
    for (const raw of paths.filter(Boolean)) {
      const path = cleanText(visibleText(raw));
      for (const variant of new Set([path, path.replaceAll('\\', '/'), path.replaceAll('/', '\\')])) text = text.split(variant).join('[private path]');
    }
    return text.replace(/(^|[\s("'`=:]|\[)(?:[A-Za-z]:[\\/]|\\\\[^\s\\/]+[\\/])[^\s<>"']+/gu, '$1[private path]')
      .replace(/\bfile:\/{2,3}[^\s<>"'`]+/giu, '[private path]')
      .replace(/(["'`])\/(?!\/)[^\n]*?\1/gu, '$1[private path]$1')
      .replace(/(^|[\s("'`=:]|\[)\/(?!\/)[^\s<>"'`()\]{}]+/gu, '$1[private path]')
      .replace(/(?:\.nq|coforge-(?:codex|claude-native|claude-reader)-[A-Za-z0-9]{6})(?:[\\/][^\s<>"']*)?/gu, '[private path]').slice(0, max);
  };
}

/** Sanitizes complete public observations, never transport fragments or arbitrary event payloads. */
export function sessionSanitizer(environment: NodeJS.ProcessEnv = {}, paths: readonly string[] = []) {
  const safeText = sessionTextSanitizer(environment, paths);
  return (event: AgentSessionEvent): AgentSessionEvent => {
    const identifier = (value: string | undefined) => value && safeText(value) === value ? sessionId(value) : undefined;
    return { kind: event.kind, ...(identifier(event.sessionId) ? { sessionId: identifier(event.sessionId) } : {}),
      ...(identifier(event.parentSessionId) ? { parentSessionId: identifier(event.parentSessionId) } : {}),
      ...(event.label ? { label: safeText(event.label).slice(0, 160) } : {}), ...(event.tool && identifier(event.tool) ? { tool: event.tool } : {}),
      ...(event.status ? { status: event.status } : {}), ...(event.text ? { text: safeText(event.text) } : {}) };
  };
}
