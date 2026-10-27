import { h } from "vue";
import { markdownNodes } from "./markdown-nodes";
export function useMarkdown(props: {
  source: string;
  compact?: boolean;
  links?: boolean;
}) {
  return {
    content: () =>
      h(
        props.compact ? "span" : "div",
        { class: ["cf-markdown", { "is-compact": props.compact }] },
        markdownNodes(props.source, {
          compact: props.compact,
          links: props.links,
        }),
      ),
  };
}
