import { Lexer } from "marked";
import { markdownTree, type MarkdownChild } from "./markdown";
import { escapeMarkdown } from "./sanitize";

function verifyBudget(value: unknown): void {
  let nodes = 0;
  const visit = (item: unknown, depth: number): void => {
    if (!item || typeof item !== "object") return;
    if (++nodes > 2000 || depth > 48)
      throw new Error(
        "The generated Markdown exceeds its safe publication complexity. Export the retained raw artifact for inspection.",
      );
    for (const child of Array.isArray(item) ? item : Object.values(item))
      visit(child, depth + 1);
  };
  visit(value, 0);
}
const plain = (node: MarkdownChild): string =>
  typeof node === "string" ? node : node.children.map(plain).join("");
const literal = (text: string): string =>
  text.replace(/[\\`*_{}[\]<>!|#]/gu, (character) => `\\${character}`);
function code(text: string): string {
  if (/^\s*\$?=/u.test(text)) return escapeMarkdown(text);
  const longest = Math.max(
    0,
    ...(text.match(/`+/gu) ?? []).map((item) => item.length),
  );
  const fence = "`".repeat(longest + 1);
  return `${fence} ${text} ${fence}`;
}
/** Reuses the UI's parsed allowlist, then emits inert native Markdown. Raw artifacts remain immutable. */
export function markdownForNote(source: string): string {
  if (source.length > 16000)
    throw new Error(
      "The generated Markdown exceeds its native-note publication limit.",
    );
  verifyBudget(Lexer.lex(source, { gfm: true }));
  const render = (node: MarkdownChild): string => {
    if (typeof node === "string") return literal(node);
    const children = () => node.children.map(render).join("");
    if (/^h[1-6]$/u.test(node.tag))
      return `${"#".repeat(Number(node.tag[1]))} ${children()}\n\n`;
    switch (node.tag) {
      case "p":
        return `${children()}\n\n`;
      case "strong":
        return `**${children()}**`;
      case "em":
        return `*${children()}*`;
      case "del":
        return `~~${children()}~~`;
      case "code":
        return code(plain(node));
      // Indented code has no executable Obsidian code-block language or vault transclusion semantics.
      case "pre":
        return `${plain(node)
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")}\n\n`;
      case "br":
        return "\n";
      case "hr":
        return "\n---\n\n";
      case "blockquote":
        return `${children()
          .trimEnd()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}\n\n`;
      case "ul":
        return `${node.children.map((item) => `- ${render(item).trim().replaceAll("\n", "\n  ")}`).join("\n")}\n\n`;
      case "ol":
        return `${node.children.map((item, index) => `${index + 1}. ${render(item).trim().replaceAll("\n", "\n   ")}`).join("\n")}\n\n`;
      case "input":
        return node.attributes.checked === true
          ? "\\[completed\\] "
          : "\\[pending\\] ";
      case "a": {
        const href = node.attributes.href;
        return typeof href === "string"
          ? `[${children()}](<${href.replaceAll("<", "%3C").replaceAll(">", "%3E")}>)`
          : children();
      }
      case "th":
      case "td":
        return `${children()} | `;
      case "tr":
        return `| ${children()}\n`;
      default:
        return children();
    }
  };
  return markdownTree(source, { definitions: false })
    .map(render)
    .join("")
    .trimEnd();
}
