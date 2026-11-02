import { record } from '../../../features/coforge/domain/check';

export type ReadingNode =
  | { kind: 'text' | 'code' | 'value'; text: string }
  | { kind: 'fields'; fields: { key: string; label: string; node: ReadingNode }[] }
  | { kind: 'items'; items: ReadingNode[] };

const labels: Record<string, string> = {
  trustedProject: 'Project context', untrustedCommunityProposal: 'Community proposal (untrusted)',
  streamerReviewFeedback: 'Host review feedback', currentModeration: 'Screening at capture',
  boundArtifacts: 'Referenced results', acceptanceCriteria: 'Acceptance criteria',
  costUsd: 'Cost (USD)', rice: 'RICE', ai: 'AI', id: 'ID',
};
const codeFields = new Set(['diff', 'patch', 'stdout', 'stderr', 'command', 'log', 'logs']);
const displayLabel = (key: string) => Object.hasOwn(labels, key) ? labels[key]! : key.replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
  .replace(/([a-z\d])([A-Z])/gu, '$1 $2').replace(/[_-]+/gu, ' ').replace(/\bId\b/gu, 'ID')
  .trim().replace(/^./u, letter => letter.toUpperCase()) || 'Unnamed field';

/** Layout only: outside-string whitespace changes never alter the retained source. */
function structuredLines(source: string): string {
  let result = ''; let quoted = false; let escaped = false; let depth = 0;
  for (const character of source) {
    if (quoted) {
      result += character;
      if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') quoted = false;
    } else if (character === '"') { quoted = true; result += character; }
    else if (character === '{' || character === '[') { depth++; result += character + '\n' + '  '.repeat(Math.min(depth, 10)); }
    else if (character === '}' || character === ']') { depth = Math.max(0, depth - 1); result += '\n' + '  '.repeat(Math.min(depth, 10)) + character; }
    else if (character === ',') result += ',\n' + '  '.repeat(Math.min(depth, 10));
    else if (character === ':') result += ': ';
    else result += character;
  }
  return result;
}
function structuredText(source: string): string | undefined {
  const trimmed = source.trim();
  const fenced = /^```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(trimmed)?.[1];
  const text = fenced ?? trimmed;
  if (!fenced && /^\[[^\]\r\n]*\](?:\(|:)/u.test(text)) return undefined;
  return /^\{\s*(?:"|\}|$)/u.test(text) || /^\[\s*(?:"|\{|\[|\]|-?\d|true\b|false\b|null\b|$)/u.test(text) ? text : undefined;
}

/** Bounded read-only projection of captured data. Never guesses missing JSON or mutates evidence. */
export function readingDocument(source: string, truncated = false) {
  let remaining = 40000; let budget = 400; let limited = false; let precision = false; let invalid = false;
  const take = (text: string) => {
    const length = Math.max(0, remaining); remaining -= text.length;
    if (text.length > length) limited = true;
    return text.slice(0, length);
  };
  const more = (): ReadingNode => { limited = true; return { kind: 'value', text: 'More content is available in the original text.' }; };
  const walk = (value: unknown, depth = 0, key = ''): ReadingNode => {
    if (--budget < 0 || remaining <= 0 || depth > 10) return more();
    if (typeof value === 'string') {
      if (!value.trim()) return { kind: 'value', text: 'Empty text' };
      const nested = !codeFields.has(key) && structuredText(value);
      if (nested && depth < 10 && nested.length <= 256000) {
        try { const decoded: unknown = JSON.parse(nested); return walk(decoded, depth + 1, key); } catch { /* Retain ordinary text verbatim. */ }
      }
      return { kind: codeFields.has(key) ? 'code' : 'text', text: take(value) };
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) precision = true;
      return { kind: 'value', text: String(value) };
    }
    if (typeof value === 'boolean' || value === null) return { kind: 'value', text: value === null ? 'Not provided' : value ? 'Yes' : 'No' };
    if (Array.isArray(value)) {
      const values: unknown[] = value;
      if (!values.length) return { kind: 'value', text: 'None' };
      const items: ReadingNode[] = [];
      for (const item of values) {
        if (budget <= 0 || remaining <= 0) { items.push(more()); break; }
        items.push(walk(item, depth + 1, key));
      }
      return { kind: 'items', items };
    }
    if (value && typeof value === 'object') {
      const fields: Extract<ReadingNode, { kind: 'fields' }>['fields'] = [];
      for (const [field, item] of Object.entries(record(value))) {
        if (budget <= 0 || remaining <= 0) { fields.push({ key: 'remaining', label: 'Additional content', node: more() }); break; }
        fields.push({ key: field, label: take(displayLabel(field)), node: walk(item, depth + 1, field) });
      }
      return fields.length ? { kind: 'fields', fields } : { kind: 'value', text: 'None' };
    }
    return { kind: 'value', text: 'Not provided' };
  };
  const structured = structuredText(source);
  let node: ReadingNode;
  if (structured && structured.length <= 256000) {
    try { const value: unknown = JSON.parse(structured); node = walk(value); }
    catch { invalid = true; node = { kind: 'code', text: structuredLines(take(structured)) }; }
    if (precision) { remaining = 40000; node = { kind: 'code', text: structuredLines(take(structured)) }; }
  } else if (structured) { invalid = true; node = { kind: 'code', text: structuredLines(take(structured)) }; }
  else node = source.trim() ? { kind: 'text', text: take(source) } : { kind: 'value', text: 'No text captured.' };
  return { node, limited, incomplete: !!structured && (invalid || truncated), precision };
}
