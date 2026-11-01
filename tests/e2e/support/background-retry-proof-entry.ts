import { createApp, defineComponent, h, ref } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import IdeaWorkflowTab from '../../../src/plugin/presentation/components/coforge/IdeaWorkflowTab.vue';
import { useDialogFocus } from '../../../src/plugin/presentation/composables/coforge/use-dialog-focus';
import { useStudioStore } from '../../../src/plugin/presentation/stores/coforge-studio';
import { coforgeKey, type CoforgeContext } from '../../../src/plugin/presentation/context/coforge-context';
import { StudioService } from '../../../src/plugin/features/coforge/application/studio';
import type { BackgroundBuildRetryConsent, BackgroundBuildRetryPreview } from '../../../src/plugin/features/coforge/api';
import { retryUiData } from '../../../src/plugin/tests/project/coforge/background-build-retry-ui-data';
import PolishingFeedbackDialog from '../../../src/plugin/presentation/components/coforge/PolishingFeedbackDialog.vue';
import { usePolishingUiStore } from '../../../src/plugin/presentation/stores/coforge-polishing-ui';
import { defaultImprovementPass } from '../../../src/plugin/features/coforge/domain/polishing-pass-configuration';
import { selectPolishingTarget } from '../../../src/plugin/features/coforge/domain/polishing-target';
import type { PolishingPreview, PolishingRun } from '../../../src/plugin/features/coforge/domain/polishing';
import { polishingTargetForView } from '../../../src/plugin/presentation/composables/coforge/polishing-target-for-view';

declare global {
  interface Window { coforgeRetryProof?: { inspections: number; confirmations: number; polishingPreviews: number; polishingConfirmations: number; feedback: string; providerCalls: number; closed: boolean; consent?: BackgroundBuildRetryConsent; showCleanCodeSource(attached?: boolean): void; showPendingMainDecision(): void; destroy(): void } }
}

/** Test-only composition: real presentation components, fake private snapshot API, no provider port. */
async function mountProof() {
  const proof: NonNullable<Window['coforgeRetryProof']> = { inspections: 0, confirmations: 0, polishingPreviews: 0, polishingConfirmations: 0, feedback: '', providerCalls: 0, closed: false, showCleanCodeSource: () => {}, showPendingMainDecision: () => {}, destroy: () => {} };
  class ProofStudio extends StudioService {
    preview?: BackgroundBuildRetryPreview;
    polishing?: PolishingPreview;
    override async previewBackgroundBuildRetry(): Promise<BackgroundBuildRetryPreview> {
      proof.inspections++; if (!this.preview) throw new Error('Proof receipt missing'); return structuredClone(this.preview);
    }
    override async confirmBackgroundBuildRetry(_id: string, _previewId: string, consent: BackgroundBuildRetryConsent): Promise<void> {
      proof.confirmations++; proof.consent = structuredClone(consent);
    }
    override async previewPolishingPass(_id: string, feedback: string): Promise<PolishingPreview> {
      proof.polishingPreviews++; this.lastFeedback = feedback; if (!this.polishing) throw new Error('Polishing proof receipt missing'); return { ...structuredClone(this.polishing), feedback };
    }
    override async confirmPolishingPass(_id: string, _previewId: string, consent: BackgroundBuildRetryConsent): Promise<void> {
      proof.polishingConfirmations++; proof.consent = structuredClone(consent); proof.feedback = this.lastFeedback;
    }
    lastFeedback = '';
  }
  const neverRun = async () => { proof.providerCalls++; throw new Error('Presentation proof cannot call a provider.'); };
  const studio = new ProofStudio({ load: async () => ({ data: null, notes: [], invalidNotes: [] }), save: async () => {} }, {
    timers: { setTimeout: (callback, ms) => window.setTimeout(callback, ms), clearTimeout: handle => window.clearTimeout(handle),
      setInterval: (callback, ms) => window.setInterval(callback, ms), clearInterval: handle => window.clearInterval(handle) }, runners: { demo: neverRun, claude: neverRun },
  });
  await studio.start();
  const project = await studio.createProject({ projectName: 'Retry presentation proof', projectBrief: 'Synthetic snapshot API; no provider.', projectPath: '/fixture/repo' });
  const state = studio.state(); await studio.stop();
  const data = retryUiData(project);
  data.preview.step.name = `Build ${'W'.repeat(90)}`;
  data.preview.inspection.increment!.files[0]!.path = `src/${'LongSnapshotPath'.repeat(12)}.ts`;
  data.preview.inspection.increment!.diff += `\n+${'UnbrokenReviewedCode'.repeat(30)}`;
  studio.preview = data.preview;
  project.settings.workflow = structuredClone({ ...data.run.definition, revision: data.preview.policySource.definitionRevision });
  project.settings.workflow.improvementPass = { ...defaultImprovementPass(project.settings), provider: 'claude', model: 'sonnet', effort: 'high' };
  studio.polishing = { id: 'polishing-proof', ideaId: data.idea.id, feedback: '', target: selectPolishingTarget(data.idea), sourceHash: 'proof-source',
    primaryCheckpoint: { runId: data.run.id, revision: data.run.revision, cursor: data.run.cursor, state: data.run.state, contentHash: 'checkpoint' },
    step: { id: 'polish', name: 'Improve & polish', kind: 'ai', provider: 'claude', model: 'sonnet', effort: 'high', output: 'markdown', access: 'none', automatic: false, instructions: project.settings.workflow.improvementPass.instructions },
    sourceArtifacts: data.run.artifacts, policySourceRevision: data.preview.policySource.definitionRevision, inheritedLimits: data.preview.inheritedLimits,
    effectiveLimits: data.preview.effectiveLimits, stopHold: false, oldExecutorAcknowledgementRequired: false, createdAt: data.preview.createdAt };
  state.projects = [project]; state.activeProjectId = project.id; state.settings = project.settings; state.ideas = [data.idea]; state.jobs = [];
  const pinia = createPinia(); const store = useStudioStore(pinia); store.state = state; store.select(data.idea.id, 'workflow');
  const polishing = usePolishingUiStore(pinia);
  proof.showCleanCodeSource = (attached = false) => {
    const current = store.state!.ideas[0]!; current.status = 'shipped'; delete current.workflowRun; current.increment = structuredClone(data.preview.inspection.increment!);
    const prior = studio.polishing; if (!prior) throw new Error('Missing polishing proof');
    studio.polishing = { ...prior, target: polishingTargetForView(current), sourceHash: 'code-proof', primaryCheckpoint: undefined, sourceArtifacts: [],
      step: { ...data.preview.step, id: 'polish', name: 'Code polishing', execution: attached ? undefined : data.preview.policy },
      inspection: { ...data.preview.inspection, sourceKind: 'repository', sourceWorkspaceId: undefined, sourceOwner: undefined, increment: null, fileCount: 0, totalBytes: 0, humanCessationRequired: false },
      readiness: attached ? undefined : data.preview.readiness, oldExecutorAcknowledgementRequired: false };
  };
  proof.showPendingMainDecision = () => {
    const current = store.state!.ideas[0]!; delete current.increment;
    current.workflowRun = { ...data.run, revision: 9, state: 'waiting-human', cursor: 0, attempts: [], artifacts: [],
      definition: { ...data.run.definition, steps: [{ id: 'human', kind: 'approval', name: 'Primary checkpoint', instructions: 'Review the main work.' }] } };
    const target = polishingTargetForView(current);
    const pass: PolishingRun = { id: 'pending-polishing-proof', feedback: 'Retained failed-pass feedback.', target, sourceHash: target.contentHash, previousStatus: current.status,
      consent: { oldExecutorStopped: false, changesReviewed: true, releaseStopHold: false }, sourceArtifacts: [], policySourceRevision: data.preview.policySource.definitionRevision,
      createdAt: data.preview.createdAt, review: 'pending', primaryCheckpoint: { runId: data.run.id, revision: 9, cursor: 0, state: 'waiting-human', contentHash: 'checkpoint' },
      workflow: { ...data.run, id: 'pending-polishing-proof', revision: 1, state: 'attention', cursor: 0, attempts: [], artifacts: [],
        definition: { ...data.run.definition, steps: [{ id: 'polish', kind: 'ai', name: 'Improve & polish', output: target.kind === 'request' ? 'markdown' : target.kind,
          access: 'none', provider: 'claude', model: 'sonnet', instructions: 'Polish', automatic: false }] } } };
    current.polishingRuns = [pass];
  };
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => {}, host: {
    setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => 'proof.json',
    publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }),
  } };
  const opened = ref(true);
  const Component = defineComponent({ setup() {
    const focus = useDialogFocus(() => { opened.value = false; proof.closed = true; });
    return () => [opened.value ? h('div', { class: 'cf-overlay cf-idea-overlay', style: polishing.isOpen ? { display: 'none' } : undefined }, [h('div', { ref: focus.bind, class: 'cf-drawer cf-idea-drawer',
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Retry presentation proof', onKeydown: focus.keydown }, [
      h('h2', 'Workflow runs'), h('button', { type: 'button', class: 'cf-btn', onClick: () => { opened.value = false; proof.closed = true; } }, 'Close proof'),
      h('div', { class: 'cf-idea-scroll' }, [h(IdeaWorkflowTab, { idea: store.state!.ideas[0]! })]),
    ])]) : null, polishing.isOpen ? h(PolishingFeedbackDialog) : null];
  } });
  const host = document.querySelector('.cf-studio');
  if (!host) throw new Error('The real studio style/container scope is required for the presentation proof.');
  const root = document.createElement('div'); root.dataset.retryProof = 'true'; host.append(root);
  const app = createApp(Component); app.use(pinia); app.provide(coforgeKey, context); app.directive('cf-icon', () => {}); app.mount(root);
  proof.destroy = () => { app.unmount(); store.dispose(); disposePinia(pinia); root.remove(); delete window.coforgeRetryProof; };
  window.coforgeRetryProof = proof;
}
void mountProof();
