import { computed, reactive } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { defaultImprovementPass } from '../../../features/coforge/domain/polishing-pass-configuration';
import { useWorkflowCoworkerFields } from './use-workflow-coworker-fields';
import { PROVIDERS } from './settings-fields';
import { MANAGED_NATIVE_SESSION_HELP } from './workflow-session-display';

export function usePolishingPassSettings() {
  const editor = useWorkflowEditorForm();
  const pass = computed(() => editor.draft.improvementPass);
  const coworker = useWorkflowCoworkerFields(() => pass.value, false);
  return reactive({ pass, coworker, providers: PROVIDERS,
    enabled: computed({ get: () => Boolean(pass.value), set: value => {
      if (value && editor.project) editor.draft.improvementPass = defaultImprovementPass({ ...editor.project.settings, ...editor.draft.limits });
      else delete editor.draft.improvementPass;
    } }),
    sessionHelp: MANAGED_NATIVE_SESSION_HELP,
  });
}
