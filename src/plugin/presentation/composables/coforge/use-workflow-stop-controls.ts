import { computed, ref, type ComputedRef } from 'vue';
import type { ContextMenuItem } from '@nuxt/ui';
import type { Idea, StudioProject } from '../../../features/coforge/domain/types';
import { projectFeatureEnabled } from '../../../features/coforge/domain/project-features';
import { isActiveJob } from '../../../features/coforge/domain/workflow';
import { uncertainTaskAttempt } from '../../../features/coforge/application/agent-task';
import { ideaWorkflowActionIdentity } from './idea-workflow-action';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';

export function useWorkflowStopControls(props: { idea: Idea }, project: ComputedRef<StudioProject | undefined>, open: () => void) {
  const store = useStudioStore(); const actions = useStudioActions(); const reviewed = ref('');
  const held = computed(() => store.state?.workflowStopHolds?.includes(props.idea.id) === true);
  const identity = () => JSON.stringify([ideaWorkflowActionIdentity(props.idea, project.value), held.value]);
  const blocked = computed(() => {
    if (!held.value) return '';
    if (store.state?.jobs.some(job => job.ideaId === props.idea.id && isActiveJob(job))) return 'Wait for the active attempt to settle. Its partial work is preserved.';
    if (props.idea.workflowRun?.state === 'awaiting-review') return 'Stopped — preserved changes need review. Open this request and review its increment first.';
    if (props.idea.workflowRun?.attempts.some(uncertainTaskAttempt)) return 'Inspect and acknowledge the uncertain task outcome in this request’s workflow before restarting.';
    if (props.idea.workflowRun?.attempts.some(attempt => attempt.councilCancellation === 'requested')) return 'Wait for the original Council cancellation to finish.';
    return '';
  });
  const control = () => {
    if (store.busy || !projectFeatureEnabled(project.value, 'workflow')) return;
    if (identity() !== reviewed.value) { store.notify('This request changed. Reopen its action menu and review it again.', true); return; }
    if (blocked.value) { store.notify(blocked.value, true); return; }
    if (held.value) void actions.restartWorkflow(props.idea.id); else void actions.stopWorkflow(props.idea.id);
  };
  const items = computed<ContextMenuItem[]>(() => {
    if (!projectFeatureEnabled(project.value, 'workflow') || !props.idea.workflowRun || ['shipped', 'rejected'].includes(props.idea.status)) return [];
    return [
      ...(held.value ? [{ label: 'View stopped workflow', icon: 'i-lucide-workflow', onSelect: open }] : []),
      { label: held.value ? 'Restart workflow' : 'Stop workflow', icon: held.value ? 'i-lucide-play' : 'i-lucide-square',
        disabled: store.busy || Boolean(blocked.value), description: blocked.value || (held.value
          ? 'Starts at the first step using the saved workflow. Previous run evidence is preserved.'
          : 'Returns this card to Inbox and prevents automatic starts until you explicitly restart it.'), onSelect: control },
    ];
  });
  return { held, items, review: () => { reviewed.value = identity(); } };
}
