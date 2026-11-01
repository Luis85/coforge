import { computed, reactive } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { defaultImprovementPass } from '../../../features/coforge/domain/polishing-pass-configuration';
import type { DurableBuildPolicy } from '../../../features/coforge/domain/durable-build';
import { useWorkflowCoworkerFields } from './use-workflow-coworker-fields';
import { PROVIDERS } from './settings-fields';

export function usePolishingPassSettings() {
  const editor = useWorkflowEditorForm();
  const pass = computed(() => editor.draft.improvementPass);
  const coworker = useWorkflowCoworkerFields(() => pass.value, false);
  const policy = computed(() => pass.value?.execution);
  function ensure() { const current = pass.value; if (!current) return; return current.execution ??= { mode: 'background', idleWarningSeconds: 1800 }; }
  type NumberKey = Exclude<keyof DurableBuildPolicy, 'mode'>;
  function optional(key: NumberKey, fallback: () => number) {
    return computed({ get: () => policy.value?.[key] !== undefined, set: value => { const current = ensure(); if (!current) return; if (value) current[key] = fallback(); else delete current[key]; } });
  }
  function number(key: NumberKey, fallback: () => number, scale = 1) {
    return computed({ get: () => (policy.value?.[key] ?? fallback()) / scale, set: value => { const current = ensure(); if (current) current[key] = Number(value) * scale; } });
  }
  return reactive({ pass, coworker, providers: PROVIDERS,
    enabled: computed({ get: () => Boolean(pass.value), set: value => {
      if (value && editor.project) editor.draft.improvementPass = defaultImprovementPass({ ...editor.project.settings, ...editor.draft.limits });
      else delete editor.draft.improvementPass;
    } }),
    deadlineEnabled: optional('maxRuntimeSeconds', () => 360000), deadlineHours: number('maxRuntimeSeconds', () => 360000, 3600),
    idleEnabled: computed({ get: () => policy.value?.idleWarningSeconds !== 0, set: value => { const current = ensure(); if (current) current.idleWarningSeconds = value ? 1800 : 0; } }),
    idleMinutes: number('idleWarningSeconds', () => 1800, 60),
    turnsEnabled: optional('maxTurns', () => pass.value?.limits.maxTurns ?? 12), turns: number('maxTurns', () => pass.value?.limits.maxTurns ?? 12),
    budgetEnabled: optional('maxBudgetUsd', () => pass.value?.limits.maxBudgetUsd ?? 1), budget: number('maxBudgetUsd', () => pass.value?.limits.maxBudgetUsd ?? 1),
  });
}
