import { computed, reactive } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { useCoforge } from '../../context/coforge-context';
import type { NativeWorkflowTools } from '../../../features/coforge/domain/native-workflow-tools';
import { CODEX_PROVIDER_CONTEXT_HELP } from './codex-provider-context';
import { isWorktreeCodingStep } from '../../../features/coforge/domain/worktree-coding';
import { NATIVE_CODING_HELP, WORKTREE_PERMISSION_HELP } from './coding-profile-display';
import { isAnalyticalWorkflowStep, resolvedAnalyticalWorkflowTools } from '../../../features/coforge/domain/workflow-analytical-tools';
import { defaultStagePrompt, hasLegacyBuildInstructions, legacyBuildInstructions } from '../../../features/coforge/domain/stage-prompts';
import { needsBuildInstructionReview } from './build-instruction-review';

export interface NativeToolsSubject { nativeTools?: NativeWorkflowTools; provider: string; coworkerId?: string; access?: string; output?: string; instructions?: string }
export function useWorkflowNativeTools(props: { subject?: NativeToolsSubject; prefix?: string; effectiveProvider?: string; providerResolved?: boolean } = {}) {
  const editor = useWorkflowEditorForm();
  const { studio } = useCoforge();
  const step = computed(() => props.subject ?? (editor.selected?.kind === 'ai' ? editor.selected : undefined));
  const host = computed(() => { void editor.store.state; return studio.integration().workflowVerification; });
  const provider = computed(() => props.effectiveProvider ?? step.value?.provider ?? '');
  const supported = computed(() => (props.providerResolved ?? !step.value?.coworkerId) && ['claude', 'codex'].includes(provider.value));
  const coding = computed(() => supported.value && isWorktreeCodingStep({ kind: 'ai', access: step.value?.access ?? (props.subject ? 'editworktree' : 'none'), output: step.value?.output ?? (props.subject ? 'codechange' : '') }, provider.value));
  const analytical = computed(() => !!step.value && supported.value && isAnalyticalWorkflowStep({ kind: 'ai', access: step.value.access ?? 'none', output: step.value.output ?? '' }, provider.value));
  const textAnalytical = computed(() => Boolean(props.subject && coding.value));
  const analyticalDefaults = computed(() => step.value && (analytical.value || textAnalytical.value) ? resolvedAnalyticalWorkflowTools({ kind: 'ai',
    access: analytical.value ? step.value.access ?? 'none' : 'none', output: analytical.value ? step.value.output ?? '' : 'markdown' }, provider.value) : undefined);
  function clean(): void { const current = step.value; if (current?.nativeTools && current.nativeTools.delegation === undefined && current.nativeTools.research === undefined && !current.nativeTools.verification) delete current.nativeTools; }
  function limit(): number { const delegation = step.value?.nativeTools?.delegation; return delegation ? delegation.maxConcurrent : 2; }
  const legacyStarter = computed(() => coding.value && hasLegacyBuildInstructions(step.value?.instructions ?? ''));
  return reactive({
    step, host, coding, analytical, textAnalytical, supported, codingHelp: NATIVE_CODING_HELP, boundaryHelp: WORKTREE_PERMISSION_HELP,
    providerContextHelp: computed(() => provider.value === 'codex' ? CODEX_PROVIDER_CONTEXT_HELP : ''),
    access: computed(() => step.value?.access ?? 'editworktree'),
    label: (text: string) => props.prefix ? `${props.prefix} ${text}` : text,
    delegation: computed({ get: () => Boolean(step.value?.nativeTools?.delegation ?? analyticalDefaults.value?.delegation), set: active => { if (step.value) (step.value.nativeTools ??= {}).delegation = active ? { maxConcurrent: limit() } : false; } }),
    research: computed({ get: () => step.value?.nativeTools?.research ?? analyticalDefaults.value?.research ?? false, set: active => { if (step.value && (analytical.value || textAnalytical.value || !active)) (step.value.nativeTools ??= {}).research = active; } }),
    unavailableResearch: computed(() => !analytical.value && !textAnalytical.value && step.value?.nativeTools?.research === true),
    concurrency: computed({ get: limit, set: value => { if (step.value) (step.value.nativeTools ??= {}).delegation = { maxConcurrent: Number(value) }; } }),
    codingConcurrency: computed({ get: limit, set: value => { if (step.value) (step.value.nativeTools ??= {}).delegation = { maxConcurrent: Number(value) }; } }),
    codingCapacityFixed: computed(() => textAnalytical.value && step.value?.nativeTools?.delegation === false),
    textPolishingHelp: computed(() => {
      const policy = step.value?.nativeTools;
      const assistants = policy?.delegation === false ? 'disabled by this saved preference' : 'enabled by default';
      const research = policy?.research === false ? 'disabled by this saved preference' : 'enabled by default';
      return `Text-only improvements keep restricted analysis access: native assistants are ${assistants}, and native web research is ${research}. They do not gain coding tools, shell commands or repository writes.`;
    }),
    legacyStarter,
    instructionReview: computed(() => coding.value && needsBuildInstructionReview(step.value?.instructions ?? '')),
    reviewInstructions: () => editor.revealIssue(props.subject ? 'improvementPass.instructions' : 'instructions', !!props.subject),
    updateStarter: () => {
      const current = step.value;
      if (current?.instructions && legacyStarter.value) current.instructions = defaultStagePrompt('implement') + current.instructions.slice(legacyBuildInstructions.length);
    },
    selected: computed(() => step.value?.nativeTools?.verification?.commandIds ?? []),
    clearCommands: () => { if (step.value) { delete step.value.nativeTools?.verification; clean(); } },
    toggleCommand: (id: string) => { if (!step.value) return; const selected = new Set(step.value.nativeTools?.verification?.commandIds); if (selected.has(id)) selected.delete(id); else selected.add(id); if (selected.size) (step.value.nativeTools ??= {}).verification = { commandIds: [...selected] }; else { delete step.value.nativeTools?.verification; clean(); } },
  });
}
