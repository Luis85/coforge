import { markdownTree, type MarkdownChild } from "./markdown";
const tags = new Set([
  "span",
  "div",
  "p",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "br",
  "hr",
  "a",
  "blockquote",
  "ol",
  "ul",
  "li",
  "input",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);
const attributes = new Set([
  "class",
  "tabindex",
  "role",
  "aria-label",
  "type",
  "checked",
  "disabled",
]);
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
/** Static public exports use the same parser/allowlist as Vue, with all links disabled. */
export function markdownHtml(source: string): string {
  const render = (node: MarkdownChild): string => {
    if (typeof node === "string") return escape(node);
    if (!tags.has(node.tag)) return "";
    const attrs = Object.entries(node.attributes)
      .filter(
        ([key, value]) =>
          attributes.has(key) &&
          (typeof value === "string" ||
            typeof value === "number" ||
            value === true),
      )
      .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
      .join("");
    return `<${node.tag}${attrs}>${["br", "hr", "input"].includes(node.tag) ? "" : node.children.map(render).join("") + `</${node.tag}>`}`;
  };
  return markdownTree(source, { links: false }).map(render).join("");
}
