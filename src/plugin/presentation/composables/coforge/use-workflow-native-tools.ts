import { computed, reactive } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { useCoforge } from '../../context/coforge-context';
import type { NativeWorkflowTools } from '../../../features/coforge/domain/native-workflow-tools';
import { CODEX_PROVIDER_CONTEXT_HELP } from './codex-provider-context';
import { isWorktreeCodingStep } from '../../../features/coforge/domain/worktree-coding';
import { NATIVE_CODING_HELP, WORKTREE_PERMISSION_HELP } from './coding-profile-display';

export interface NativeToolsSubject { nativeTools?: NativeWorkflowTools; provider: string; coworkerId?: string; access?: string; output?: string }
export function useWorkflowNativeTools(props: { subject?: NativeToolsSubject; prefix?: string; effectiveProvider?: string; providerResolved?: boolean } = {}) {
  const editor = useWorkflowEditorForm();
  const { studio } = useCoforge();
  const step = computed(() => props.subject ?? (editor.selected?.kind === 'ai' ? editor.selected : undefined));
  const host = computed(() => { void editor.store.state; return studio.integration().workflowVerification; });
  const provider = computed(() => props.effectiveProvider ?? step.value?.provider ?? '');
  const supported = computed(() => (props.providerResolved ?? !step.value?.coworkerId) && ['claude', 'codex'].includes(provider.value));
  const coding = computed(() => supported.value && isWorktreeCodingStep({ kind: 'ai', access: step.value?.access ?? (props.subject ? 'editworktree' : 'none'), output: step.value?.output ?? (props.subject ? 'codechange' : '') }, provider.value));
  function clean(): void { const current = step.value; if (current?.nativeTools && !current.nativeTools.delegation && !current.nativeTools.verification) delete current.nativeTools; }
  return reactive({
    step, host, coding, supported, codingHelp: NATIVE_CODING_HELP, boundaryHelp: WORKTREE_PERMISSION_HELP,
    providerContextHelp: computed(() => provider.value === 'codex' ? CODEX_PROVIDER_CONTEXT_HELP : ''),
    access: computed(() => step.value?.access ?? 'editworktree'),
    label: (text: string) => props.prefix ? `${props.prefix} ${text}` : text,
    delegation: computed({ get: () => !!step.value?.nativeTools?.delegation, set: active => { if (!step.value) return; if (active) (step.value.nativeTools ??= {}).delegation = { maxConcurrent: 2 }; else { delete step.value.nativeTools?.delegation; clean(); } } }),
    concurrency: computed({ get: () => step.value?.nativeTools?.delegation?.maxConcurrent ?? 2, set: value => { if (step.value?.nativeTools?.delegation) step.value.nativeTools.delegation.maxConcurrent = Number(value); } }),
    codingConcurrency: computed({ get: () => step.value?.nativeTools?.delegation?.maxConcurrent ?? 2, set: value => { if (step.value) (step.value.nativeTools ??= {}).delegation = { maxConcurrent: Number(value) }; } }),
    selected: computed(() => step.value?.nativeTools?.verification?.commandIds ?? []),
    clearCommands: () => { if (step.value) { delete step.value.nativeTools?.verification; clean(); } },
    toggleCommand: (id: string) => { if (!step.value) return; const selected = new Set(step.value.nativeTools?.verification?.commandIds); if (selected.has(id)) selected.delete(id); else selected.add(id); if (selected.size) (step.value.nativeTools ??= {}).verification = { commandIds: [...selected] }; else { delete step.value.nativeTools?.verification; clean(); } },
  });
}
