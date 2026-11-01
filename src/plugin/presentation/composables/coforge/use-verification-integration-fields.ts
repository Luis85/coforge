import { computed, reactive } from 'vue';
import { usePluginSettingsForm } from './use-plugin-settings';
import type { WorkflowVerificationCommand } from '../../../features/coforge/domain/native-workflow-tools';

export function useVerificationIntegrationFields() {
  const model = usePluginSettingsForm();
  const profile = computed(() => model.draft.workflowVerification);
  return reactive({
    profile,
    add: () => { profile.value?.commands.push({ id: `check-${(profile.value?.commands.length ?? 0) + 1}`, label: 'Verification command', executable: '', args: [] }); },
    remove: (index: number) => { profile.value?.commands.splice(index, 1); },
    arguments: (command: WorkflowVerificationCommand) => command.args.join('\n'),
    setArguments: (command: WorkflowVerificationCommand, event: Event) => { if (event.target instanceof HTMLTextAreaElement) command.args = event.target.value ? event.target.value.split('\n') : []; },
  });
}
