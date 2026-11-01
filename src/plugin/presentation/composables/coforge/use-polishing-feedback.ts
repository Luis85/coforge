import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import type { PolishingPreview } from '../../../features/coforge/domain/polishing';
import { polishingTargetForView } from './polishing-target-for-view';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { useStudioStore } from '../../stores/coforge-studio';
import { usePolishingUiStore } from '../../stores/coforge-polishing-ui';
import { useStudioActions } from './use-studio-actions';
import { useDialogFocus } from './use-dialog-focus';
import { MANAGED_NATIVE_SESSION_HELP } from './workflow-session-display';
import { polishingTargetLabel } from './use-polishing-result-body';
import { WORKFLOW_ACCESS_LABELS } from '../../stores/workflow-editor-draft';

export function usePolishingFeedback() {
  const ui = usePolishingUiStore(); const store = useStudioStore(); const actions = useStudioActions();
  const idea = computed(() => store.state?.ideas.find(item => item.id === ui.ideaId));
  const project = computed(() => idea.value && store.state?.projects?.find(item => item.id === ideaProjectId(idea.value!)));
  const definition = computed(() => project.value && workflowDefinition(project.value.settings));
  const config = computed(() => definition.value?.improvementPass);
  const current = computed(() => { try { return idea.value ? polishingTargetForView(idea.value) : undefined; } catch { return undefined; } });
  const preview = ref<PolishingPreview | null>(null); const working = ref(''); const error = ref('');
  const stopped = ref(false); const reviewed = ref(false); const releaseHold = ref(false); let generation = 0;
  const key = computed(() => JSON.stringify([ui.ideaId, ui.invocation, ui.feedback, current.value?.identity, current.value?.contentHash,
    idea.value?.workflowRun?.id, idea.value?.workflowRun?.revision, idea.value?.workflowRun?.cursor, idea.value?.workflowRun?.state,
    current.value?.sourceRunRevision, definition.value?.revision, config.value, store.state?.workflowStopHolds?.includes(ui.ideaId ?? '')]));
  function clear() { preview.value = null; stopped.value = false; reviewed.value = false; releaseHold.value = false; }
  watch(key, () => { const changed = preview.value && working.value !== 'confirm'; generation++; clear(); working.value = ''; error.value = changed ? 'The current result, feedback or saved pass changed. Review a new preview.' : ''; });
  onBeforeUnmount(() => { generation++; });
  function close() { if (working.value !== 'confirm') ui.close(); }
  const focus = useDialogFocus(close, 'textarea');
  async function prepare() {
    if (working.value || store.busy) return;
    error.value = '';
    if (!ui.feedback.trim()) { error.value = 'Enter feedback for this polishing pass.'; return; }
    if (!config.value) { error.value = 'Configure Improve & polish in Idea Board Workflow before requesting a preview.'; return; }
    if (!idea.value || !current.value) { error.value = 'The current result is unavailable. Restore this request before previewing.'; return; }
    const id = idea.value.id; const identity = key.value; const token = ++generation; working.value = 'preview'; clear();
    try {
      const value = await actions.previewPolishingPass(id, ui.feedback.trim());
      if (token !== generation || key.value !== identity) return;
      if (value.ideaId !== id || value.feedback !== ui.feedback.trim() || value.target.contentHash !== current.value.contentHash
        || value.target.identity !== current.value.identity || value.policySourceRevision !== definition.value?.revision) throw new Error('This preview belongs to an earlier result or configuration. Preview again.');
      preview.value = value;
    } catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : 'The polishing preview could not be prepared. Your feedback is retained.'; }
    finally { if (token === generation) working.value = ''; }
  }
  const attachedCode = computed(() => !!preview.value?.inspection && preview.value.step.output === 'codechange' && preview.value.step.access === 'editworktree'
    && ['claude', 'codex'].includes(preview.value.step.provider) && preview.value.step.execution === undefined && preview.value.readiness === undefined);
  const canConfirm = computed(() => Boolean(preview.value && !working.value && !store.busy && reviewed.value
    && (!preview.value.inspection || attachedCode.value || preview.value.readiness?.ready && preview.value.readiness.reviewedSnapshots === true)
    && (!preview.value.oldExecutorAcknowledgementRequired || stopped.value) && (!preview.value.stopHold || releaseHold.value)));
  async function confirm() {
    const receipt = preview.value; if (!receipt || !canConfirm.value) return;
    const token = ++generation; const identity = key.value; working.value = 'confirm'; error.value = '';
    try {
      await actions.confirmPolishingPass(receipt.ideaId, receipt.id, { oldExecutorStopped: stopped.value, changesReviewed: reviewed.value, releaseStopHold: releaseHold.value });
      if (token === generation && key.value === identity) ui.close(true);
    } catch (cause) { if (token === generation) { clear(); error.value = cause instanceof Error ? cause.message : 'This polishing pass was not admitted. Your feedback is retained.'; } }
    finally { if (token === generation) working.value = ''; }
  }
  async function configure() {
    const owner = project.value?.id; if (!owner) return;
    if (store.activeProject?.id !== owner && !(await actions.selectProject(owner))) return;
    ui.close(); store.select(null); await nextTick(); store.openWorkflowTool('settings');
  }
  return reactive({ ui, idea, config, current, preview, working, error, focus, stopped, reviewed, releaseHold, canConfirm,
    sessionHelp: MANAGED_NATIVE_SESSION_HELP,
    managedPreview: computed(() => ['claude', 'codex'].includes(preview.value?.step.provider ?? '')),
    storeBusy: computed(() => store.busy),
    targetLabel: computed(() => current.value ? polishingTargetLabel(current.value.kind) : 'Current result'),
    accessLabel: computed(() => preview.value ? WORKFLOW_ACCESS_LABELS[preview.value.step.access] : ''),
    providerHelp: computed(() => preview.value?.step.provider === 'codex' ? 'Codex uses its existing CLI sign-in. Provider account and service restrictions still apply; reported usage is separate from billing.'
      : preview.value?.step.provider === 'herdr' ? 'Herdr owns the external session. Its interactive spending limits are configured externally, and cancelling a wait does not prove its agent stopped.'
        : preview.value?.step.provider === 'demo' ? 'Simulation makes no live model call. Its output still needs explicit review before applying it.' : ''),
    close, prepare: () => { void prepare(); }, confirm: () => { void confirm(); }, configure: () => { void configure(); },
  });
}
