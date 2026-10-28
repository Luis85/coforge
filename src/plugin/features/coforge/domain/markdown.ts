import { Lexer } from "marked";
import { record } from "./check";
export type MarkdownChild =
  | string
  | {
      tag: string;
      attributes: Record<string, unknown>;
      children: MarkdownChild[];
    };

export interface MarkdownOptions {
  compact?: boolean;
  links?: boolean;
  definitions?: boolean;
}
const string = (value: unknown) => (typeof value === "string" ? value : "");
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
function entities(text: string): string {
  const names: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
  };
  return text.replace(
    /&(#\d{1,7}|#x[\da-f]{1,6}|amp|lt|gt|quot|apos|nbsp);/gi,
    (raw: string, key: string) => {
      if (!key.startsWith("#")) return names[key.toLowerCase()] ?? raw;
      const code =
        key[1]?.toLowerCase() === "x"
          ? Number.parseInt(key.slice(2), 16)
          : Number(key.slice(1));
      return code > 31 &&
        code <= 0x10ffff &&
        !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : raw;
    },
  );
}
function safeHref(value: unknown): string | null {
  const href = entities(string(value));
  if (href.length > 2048) return null;
  const controls = [...href].some(
    (character) =>
      character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
  );
  return /^https?:\/\/[^\s/?#]+(?:[/?#]|$)/i.test(href) &&
    !controls &&
    !/^https?:\/\/[^/?#]*@/i.test(href)
    ? href
    : null;
}
/** Marked supplies syntax tokens; only this allowlist creates structured nodes. Raw HTML remains text.
 * No innerHTML, Obsidian renderer, embeds, media element, privileged link or remote request is involved. */
export function markdownTree(
  source: string,
  options: MarkdownOptions = {},
): MarkdownChild[] {
  const text = source.slice(0, options.compact ? 3000 : 40000);
  let budget = 4000;
  const element = (
    tag: string,
    children: MarkdownChild[],
    attrs: Record<string, unknown> = {},
  ) => ({ tag, attributes: attrs, children });
  const walk = (values: unknown, depth = 0): MarkdownChild[] =>
    array(values).flatMap((value): MarkdownChild[] => {
      if (--budget < 0) return [];
      const token = record(value);
      const type = string(token.type);
      const plain = string(token.text || token.raw);
      if (depth > 24) return [plain];
      const children = () =>
        token.tokens ? walk(token.tokens, depth + 1) : [entities(plain)];
      const block = (tag: string, content: MarkdownChild[]) =>
        element(
          options.compact ? "span" : tag,
          options.compact ? [...content, " "] : content,
        );
      switch (type) {
        case "space":
          return options.compact ? [" "] : [];
        case "text":
        case "escape":
          return children();
        case "paragraph":
          return [block("p", children())];
        case "heading": {
          const level =
            typeof token.depth === "number"
              ? Math.min(6, Math.max(1, token.depth))
              : 3;
          return [
            element(options.compact ? "strong" : `h${level}`, [
              ...children(),
              ...(options.compact ? [" "] : []),
            ]),
          ];
        }
        case "strong":
          return [element("strong", children())];
        case "em":
          return [element("em", children())];
        case "del":
          return [element("del", children())];
        case "codespan":
          return [element("code", [plain])];
        case "code":
          return [
            options.compact
              ? element("code", [plain + " "])
              : element("pre", [element("code", [plain])]),
          ];
        case "br":
          return [options.compact ? " " : element("br", [])];
        case "hr":
          return [options.compact ? " " : element("hr", [])];
        case "html":
          return [string(token.raw) || plain];
        case "image":
          return [
            element(
              "span",
              [entities(plain) || "Image", " (image not loaded)"],
              { class: "cf-markdown-media" },
            ),
          ];
        case "link": {
          const href =
            options.links === false || options.compact
              ? null
              : safeHref(token.href);
          return href
            ? [
                element("a", children(), {
                  href,
                  target: "_blank",
                  rel: "noopener noreferrer",
                }),
              ]
            : children();
        }
        case "blockquote":
          return [block("blockquote", children())];
        case "list": {
          const items = array(token.items).map((item, index) => {
            const data = record(item);
            const content = walk(data.tokens, depth + 1);
            const task: MarkdownChild[] =
              data.task === true && !options.compact
                ? [
                    element("input", [], {
                      type: "checkbox",
                      checked: data.checked === true,
                      disabled: true,
                      "aria-label":
                        data.checked === true
                          ? "Completed task"
                          : "Incomplete task",
                    }),
                  ]
                : [];
            return options.compact
              ? element("span", [
                  `${token.ordered ? index + 1 + "." : "-"} `,
                  ...content,
                  " ",
                ])
              : element("li", [...task, ...content]);
          });
          return [block(token.ordered ? "ol" : "ul", items)];
        }
        case "table": {
          const cell = (input: unknown, header: boolean) => {
            const data = record(input);
            return element(options.compact ? "span" : header ? "th" : "td", [
              ...walk(data.tokens, depth + 1),
              ...(options.compact ? [" · "] : []),
            ]);
          };
          const header = array(token.header)
            .slice(0, 30)
            .map((item) => cell(item, true));
          const rows = array(token.rows)
            .slice(0, 200)
            .map((row) =>
              element(
                options.compact ? "span" : "tr",
                array(row)
                  .slice(0, 30)
                  .map((item) => cell(item, false)),
              ),
            );
          return options.compact
            ? [element("span", [...header, ...rows])]
            : [
                element(
                  "div",
                  [
                    element("table", [
                      element("thead", [element("tr", header)]),
                      element("tbody", rows),
                    ]),
                  ],
                  {
                    class: "cf-markdown-table",
                    tabindex: 0,
                    role: "region",
                    "aria-label": "Markdown table",
                  },
                ),
              ];
        }
        case "def":
          return options.definitions === false ? [] : [entities(plain)];
        default:
          return [entities(plain)];
      }
    });
  try {
    return walk(Lexer.lex(text, { gfm: true }));
  } catch {
    return [text];
  }
}
