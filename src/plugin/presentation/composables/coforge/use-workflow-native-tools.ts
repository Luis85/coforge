import { computed, reactive } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { useCoforge } from '../../context/coforge-context';
import type { NativeWorkflowTools } from '../../../features/coforge/domain/native-workflow-tools';
import { CODEX_PROVIDER_CONTEXT_HELP } from './codex-provider-context';

export interface NativeToolsSubject { nativeTools?: NativeWorkflowTools; provider: string; coworkerId?: string; access?: string }
export function useWorkflowNativeTools(props: { subject?: NativeToolsSubject; prefix?: string } = {}) {
  const editor = useWorkflowEditorForm();
  const { studio } = useCoforge();
  const step = computed(() => props.subject ?? (editor.selected?.kind === 'ai' ? editor.selected : undefined));
  const host = computed(() => { void editor.store.state; return studio.integration().workflowVerification; });
  function clean(): void { const current = step.value; if (current?.nativeTools && !current.nativeTools.delegation && !current.nativeTools.verification) delete current.nativeTools; }
  return reactive({
    step, host,
    providerContextHelp: computed(() => step.value?.provider === 'codex' ? CODEX_PROVIDER_CONTEXT_HELP : ''),
    access: computed(() => step.value?.access ?? 'editworktree'),
    label: (text: string) => props.prefix ? `${props.prefix} ${text}` : text,
    supported: computed(() => !!step.value?.coworkerId || ['claude', 'codex'].includes(step.value?.provider ?? '')),
    delegation: computed({ get: () => !!step.value?.nativeTools?.delegation, set: active => { if (!step.value) return; if (active) (step.value.nativeTools ??= {}).delegation = { maxConcurrent: 2 }; else { delete step.value.nativeTools?.delegation; clean(); } } }),
    concurrency: computed({ get: () => step.value?.nativeTools?.delegation?.maxConcurrent ?? 2, set: value => { if (step.value?.nativeTools?.delegation) step.value.nativeTools.delegation.maxConcurrent = Number(value); } }),
    selected: computed(() => step.value?.nativeTools?.verification?.commandIds ?? []),
    clearCommands: () => { if (step.value) { delete step.value.nativeTools?.verification; clean(); } },
    toggleCommand: (id: string) => { if (!step.value) return; const selected = new Set(step.value.nativeTools?.verification?.commandIds); if (selected.has(id)) selected.delete(id); else selected.add(id); if (selected.size) (step.value.nativeTools ??= {}).verification = { commandIds: [...selected] }; else { delete step.value.nativeTools?.verification; clean(); } },
  });
}
