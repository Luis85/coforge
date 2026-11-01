import { computed, reactive } from 'vue';
import type { PolishingTarget } from '../../../features/coforge/domain/polishing';
import { planMarkdown } from '../../../features/coforge/domain/types';

export function polishingTargetLabel(kind: PolishingTarget['kind']): string {
  return { request: 'Request text', markdown: 'Answer or output', design: 'Design specification', screening: 'Screening result', rice: 'RICE assessment', plan: 'Implementation plan', codechange: 'Code changes' }[kind];
}

export function usePolishingResultBody(value: () => PolishingTarget['value']) {
  return reactive({ value: computed(value), plan: computed(() => value().plan ? value().plan!.markdown || planMarkdown(value().plan!, 'Current result') : '') });
}
