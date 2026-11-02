import { computed, h, type VNode } from 'vue';
import { markdownNodes } from './markdown-nodes';
import { readingDocument, type ReadingNode } from './readable-content';

function readingNode(node: ReadingNode): VNode {
  switch (node.kind) {
    case 'fields': return h('dl', { class: 'cf-readable-fields' }, node.fields.map(field => h('div', { class: 'cf-readable-field' }, [
      h('dt', { title: field.key }, field.label), h('dd', [readingNode(field.node)]),
    ])));
    case 'items': return h('ol', { class: 'cf-readable-items' }, node.items.map(item => h('li', [readingNode(item)])));
    case 'code': return h('pre', { class: 'cf-readable-code', tabindex: 0 }, node.text);
    case 'value': return h('span', { class: 'cf-readable-value' }, node.text);
    case 'text': return h('div', { class: 'cf-markdown' }, markdownNodes(node.text));
  }
}

export function useReadableContent(props: { source: string; truncated?: boolean }) {
  const document = computed(() => readingDocument(props.source, props.truncated));
  return { document, content: () => readingNode(document.value.node) };
}
