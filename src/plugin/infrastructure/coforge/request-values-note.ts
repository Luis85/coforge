import type { Plugin, TFile } from "obsidian";
import { isMap, isScalar, parseDocument, stringify } from "yaml";
import {
  ideaProperties,
  OWNED_PROPERTIES,
} from "../../features/coforge/domain/idea-note";
import { requestObjectPropertyKeys } from "../../features/coforge/domain/request-object-note";
import { requestObjectEditIdentity } from "../../features/coforge/domain/request-object-integrity";
import type { Idea } from "../../features/coforge/domain/types";
import type { NoteIdea } from "../../features/coforge/application/ports";

/** Rewrite only managed YAML ranges; unrelated frontmatter and the entire Markdown body stay byte-identical. */
export function writeManagedIdeaProperties(current: string, idea: Idea, author: string): string {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(current);
  if (!match)
    throw new Error(
      "The canonical request frontmatter is missing. Restore it before saving.",
    );
  const yaml = match[2] ?? "";
  const document = parseDocument(yaml, { uniqueKeys: true, strict: true });
  if (
    document.errors.length ||
    document.warnings.length ||
    !isMap(document.contents)
  )
    throw new Error(
      "The canonical request frontmatter is invalid. Repair it before saving.",
    );
  const owned = new Set<string>([
    ...OWNED_PROPERTIES,
    ...requestObjectPropertyKeys(idea.requestObject),
  ]);
  const ranges: { start: number; end: number }[] = [];
  for (const pair of document.contents.items) {
    if (
      !isScalar(pair.key) ||
      typeof pair.key.value !== "string" ||
      !owned.has(pair.key.value)
    )
      continue;
    if (
      !pair.key.range ||
      !pair.value ||
      !("range" in pair.value) ||
      !pair.value.range
    )
      throw new Error(
        "A managed property cannot be safely updated. Repair its note first.",
      );
    ranges.push({ start: pair.key.range[0], end: pair.value.range[2] });
  }
  let untouched = yaml;
  for (const range of ranges.sort((a, b) => b.start - a.start))
    untouched = untouched.slice(0, range.start) + untouched.slice(range.end);
  const eol = match[1]?.includes("\r\n") ? "\r\n" : "\n";
  const managed = stringify(ideaProperties(idea, author), { lineWidth: 0 })
    .replace(/\n$/u, "")
    .replaceAll("\n", eol);
  return `${match[1]}${untouched}${untouched && !/\r?\n$/u.test(untouched) ? eol : ""}${managed}${match[3]}${current.slice(match[0].length)}`;
}
export async function writeRequestValuesNote(
  plugin: Plugin,
  file: TFile,
  idea: Idea,
  author: string,
  expectedInputIdentity: string,
  read: (content: string) => NoteIdea | null,
): Promise<() => Promise<void>> {
  let before = "";
  let after = "";
  const rollback = async () => {
    let restored = false;
    await plugin.app.vault.process(file, (current) => {
      if (current !== after) return current;
      restored = true;
      return before;
    });
    if (!restored)
      throw new Error(
        "The request changed while storage failed. Its current note was preserved; refresh before retrying.",
      );
  };
  try {
    await plugin.app.vault.process(file, (current) => {
      const source = read(current);
      if (
        !source ||
        source.id !== idea.id ||
        requestObjectEditIdentity(source) !== expectedInputIdentity
      )
        throw new Error(
          "The request note changed outside this form. Refresh and review it before saving; no values were overwritten.",
        );
      before = current;
      after = writeManagedIdeaProperties(current, idea, author);
      return after;
    });
  } catch (error) {
    if (after && (await plugin.app.vault.read(file)) === after)
      await rollback();
    throw error;
  }
  return rollback;
}
