import { list, shape, text, noteTimestamp } from "./check";
import { escapeMarkdown, defangProperty } from "./sanitize";
export interface IdeaContext {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}
export const ideaContextsCheck = list(
  shape(
    {
      id: text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9-]+$/ }),
      authorId: text({ min: 3, max: 120 }),
      authorName: text({ min: 1, max: 50 }),
      text: text({ min: 1, max: 1500 }),
      createdAt: noteTimestamp,
    },
    { strict: true },
  ),
  { max: 100 },
);
export const contextProperties = (entries: IdeaContext[]) =>
  entries.map((entry) => ({
    ...entry,
    authorName: defangProperty(entry.authorName),
    text: defangProperty(entry.text),
  }));
/** Append-only mirror; original body bytes and prior sections remain untouched. */
export function appendContextBody(
  body: string,
  entries: IdeaContext[],
): string {
  let next = body;
  for (const entry of entries) {
    const marker = `<!-- coforge-context:${entry.id} -->`;
    if (!next.includes(marker))
      next += `\n\n${marker}\n### Context from ${escapeMarkdown(entry.authorName)} · ${entry.createdAt}\n\n${escapeMarkdown(entry.text)}\n`;
  }
  return next;
}
