import { h, type VNodeChild } from "vue";
import {
  markdownTree,
  type MarkdownChild,
  type MarkdownOptions,
} from "../../../features/coforge/domain/markdown";
export type { MarkdownOptions };
export function markdownNodes(
  source: string,
  options: MarkdownOptions = {},
): VNodeChild[] {
  const render = (node: MarkdownChild): VNodeChild =>
    typeof node === "string"
      ? node
      : h(node.tag, node.attributes, node.children.map(render));
  return markdownTree(source, options).map(render);
}
