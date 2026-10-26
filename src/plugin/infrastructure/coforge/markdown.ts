/** Splits frontmatter from Markdown without changing body bytes or line endings. */
export function splitNote(content: string): { yaml: string | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return match ? { yaml: match[1] ?? '', body: content.slice(match[0].length) } : { yaml: null, body: content };
}
