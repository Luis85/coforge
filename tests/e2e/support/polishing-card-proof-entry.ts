import { createApp, defineComponent, h, type Directive } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { icons } from '@iconify-json/lucide';
import IdeaBoard from '../../../src/plugin/presentation/components/coforge/IdeaBoard.vue';
import { useStudioStore } from '../../../src/plugin/presentation/stores/coforge-studio';
import { coforgeKey, type CoforgeContext } from '../../../src/plugin/presentation/context/coforge-context';
import { StudioService } from '../../../src/plugin/features/coforge/application/studio';
import type { AgentJob, Idea } from '../../../src/plugin/features/coforge/domain/types';
import type { PolishingRun } from '../../../src/plugin/features/coforge/domain/polishing';
import type { AiWorkflowStep } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { workflowArtifactHash, workflowProposalRevision } from '../../../src/plugin/features/coforge/domain/configured-workflow-run';
import { selectPolishingTarget } from '../../../src/plugin/features/coforge/domain/polishing-target';
import { materializeWorkflowBuckets } from '../../../src/plugin/features/coforge/domain/workflow-buckets';
import { createSeed } from '../../../src/plugin/features/coforge/domain/seed';
import { retryUiData } from '../../../src/plugin/tests/project/coforge/background-build-retry-ui-data';

type Phase = 'queued' | 'running' | 'review' | 'applied' | 'attention' | 'rejected';
declare global {
  interface Window { coforgePolishingCardProof?: { transition(phase: Phase): void; useNativePalette(theme: 'light' | 'dark'): void; wrapColumns(): void; checkpoint(): string; readonly providerCalls: number; destroy(): void } }
}

/** Read-only presentation fixture: fake run events, real board/card, no provider capability. */
async function mountProof() {
  let providerCalls = 0;
  const neverRun = async () => { providerCalls++; throw new Error('The card proof cannot invoke a provider.'); };
  const studio = new StudioService({ load: async () => ({ data: null, notes: [], invalidNotes: [] }), save: async () => {} }, {
    timers: { setTimeout: (callback, ms) => window.setTimeout(callback, ms), clearTimeout: handle => window.clearTimeout(handle),
      setInterval: (callback, ms) => window.setInterval(callback, ms), clearInterval: handle => window.clearInterval(handle) },
    runners: { demo: neverRun, claude: neverRun },
  });
  await studio.start();
  const project = await studio.createProject({ projectName: 'Polishing card proof', projectBrief: 'Synthetic run events only.', projectPath: '/fixture/repo' });
  const state = studio.state(); await studio.stop();
  const data = retryUiData(project); const at = '2026-11-01T10:00:00Z';
  const fixtureIdea: Idea = { ...data.idea, status: 'review', lastError: 'The earlier primary Build timed out.',
    title: 'Polish the current result without moving its workflow checkpoint',
    description: 'Keep this result and its history. ' + 'LongResultReference'.repeat(18) };
  data.run.proposalRevision = workflowProposalRevision(fixtureIdea);
  for (const artifact of data.run.artifacts) { artifact.proposalRevision = data.run.proposalRevision; artifact.contentHash = workflowArtifactHash(artifact); }
  const acceptedSample = createSeed().ideas.find(idea => idea.status === 'shipped');
  if (!acceptedSample) throw new Error('The illustrative accepted result is required for semantic status coverage.');
  const acceptedIdea: Idea = { ...acceptedSample, id: 'CF-902', number: 902, projectId: project.id };
  project.settings.workflow = materializeWorkflowBuckets(data.run.definition);
  state.projects = [project]; state.activeProjectId = project.id; state.settings = project.settings; state.ideas = [fixtureIdea, acceptedIdea]; state.jobs = [];
  const pinia = createPinia(); const store = useStudioStore(pinia); store.state = state;
  const step: AiWorkflowStep = { id: 'polish', name: 'Improve & polish', kind: 'ai', output: 'markdown', access: 'none',
    provider: 'claude', model: 'sonnet', instructions: 'Polish the saved result.', automatic: false };
  const target = selectPolishingTarget(fixtureIdea);
  const pass: PolishingRun = { id: 'polishing-card-pass', sourceHash: target.contentHash, feedback: 'Improve the current plan wording.',
    target, previousStatus: fixtureIdea.status, sourceArtifacts: data.run.artifacts, policySourceRevision: data.run.definition.revision,
    consent: { oldExecutorStopped: false, changesReviewed: true, releaseStopHold: false }, createdAt: at, review: 'pending',
    workflow: { ...data.run, id: 'polishing-card-pass', definition: { ...data.run.definition, steps: [step] }, revision: 1,
      cursor: 0, state: 'running', attempts: [], artifacts: [], activeAttemptId: 'polishing-card-attempt', error: undefined },
  };
  const transition = (phase: Phase) => {
    const idea = store.state!.ideas[0]!; const current = structuredClone(pass);
    current.review = phase === 'applied' ? 'applied' : phase === 'rejected' ? 'rejected' : 'pending';
    const done = ['review', 'applied', 'rejected'].includes(phase); const failed = phase === 'attention';
    current.workflow.state = done ? 'finished' : failed ? 'attention' : 'running'; current.workflow.cursor = done ? 1 : 0;
    current.workflow.error = failed ? 'The auxiliary pass needs inspection.' : undefined;
    current.workflow.attempts = [{ id: 'polishing-card-attempt', stepId: step.id, stepName: step.name, kind: 'ai',
      status: done ? 'succeeded' : failed ? 'failed' : phase === 'queued' ? 'queued' : 'running', inputs: [], startedAt: at, jobId: 'polishing-card-job' }];
    if (done) {
      const artifact = { ...data.run.artifacts[0]!, id: 'polished-plan', runId: current.workflow.id, stepId: step.id,
        attemptId: 'polishing-card-attempt', markdown: 'A clearer retained plan.', contentHash: '' };
      artifact.contentHash = workflowArtifactHash(artifact); current.workflow.artifacts = [artifact]; delete current.workflow.activeAttemptId;
    }
    const job: AgentJob = { id: 'polishing-card-job', ideaId: idea.id, projectId: project.id, stage: 'plan', provider: 'claude',
      status: done ? 'succeeded' : failed ? 'failed' : phase === 'queued' ? 'queued' : 'running', startedAt: at, logs: [], workflow: { runId: current.workflow.id,
        polishingId: current.id, definitionRevision: current.workflow.definition.revision, proposalRevision: current.workflow.proposalRevision,
        attemptId: 'polishing-card-attempt', step, inputArtifacts: [] } };
    idea.polishingRuns = [current]; store.state!.jobs = [job];
  };
  transition('queued');
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => {}, host: {
    setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => 'proof.json',
    publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }),
  } };
  const host = document.querySelector('.cf-studio'); if (!host) throw new Error('The styled studio scope is required.');
  const root = document.createElement('div'); root.dataset.polishingCardProof = 'true';
  Object.assign(root.style, { position: 'fixed', inset: '0', zIndex: '1000', background: 'var(--cf-bg)', overflow: 'auto', padding: '20px' }); host.append(root);
  const app = createApp(defineComponent({ setup: () => () => h('section', { role: 'region', 'aria-label': 'Polishing card presentation proof' }, [h(IdeaBoard)]) }));
  const renderIcon = (element: HTMLElement, name: string) => {
    const icon = icons.icons[name]; element.innerHTML = icon ? `<svg viewBox="0 0 24 24" aria-hidden="true">${icon.body}</svg>` : '';
  };
  const drawIcon: Directive<HTMLElement, string> = { mounted: (element, binding) => renderIcon(element, binding.value),
    updated: (element, binding) => { if (binding.value !== binding.oldValue) renderIcon(element, binding.value); } };
  app.use(pinia); app.provide(coforgeKey, context); app.directive('cf-icon', drawIcon); app.mount(root);
  window.coforgePolishingCardProof = { transition, useNativePalette: theme => {
    // Portable native-theme inputs include the exact semantic colors reported by Linux CI.
    // Local overrides belong only to this disposable presentation fixture, never the host's theme.
    const dark = theme === 'dark';
    const colors = { '--color-red': dark ? '#fb464c' : '#e93147', '--color-purple': dark ? '#a882ff' : '#7852ee',
      '--color-orange': dark ? '#e9973f' : '#ec7500', '--color-green': dark ? '#44cf6e' : '#08b94e',
      '--background-primary': dark ? '#1e1e1e' : '#ffffff', '--background-secondary': dark ? '#282828' : '#f6f6f6',
      '--background-primary-alt': dark ? '#242424' : '#fafafa', '--text-normal': dark ? '#dadada' : '#333333',
      '--text-muted': dark ? '#b3b3b3' : '#5c5c5c', '--text-faint': dark ? '#999999' : '#666666',
      '--interactive-accent': '#8a5cf5', '--text-on-accent': '#ffffff', '--text-accent': dark ? '#c4a7ff' : '#6840c2',
      '--text-error': dark ? '#fb464c' : '#e93147', '--background-modifier-border': dark ? '#404040' : '#d5d5d5',
      '--background-modifier-border-hover': dark ? '#606060' : '#b5b5b5', '--interactive-normal': dark ? '#363636' : '#ededed' };
    for (const [name, value] of Object.entries(colors)) root.style.setProperty(name, value);
    // Rebind aliases at the fixture root because inherited custom-property aliases were resolved on the host.
    const aliases = { '--cf-bg': 'var(--background-primary)', '--cf-surface': 'var(--background-secondary)',
      '--cf-surface-raised': 'var(--background-primary-alt)', '--cf-text': 'var(--text-normal)', '--cf-muted': 'var(--text-muted)',
      '--cf-faint': 'var(--text-faint)', '--cf-accent': 'var(--interactive-accent)', '--cf-accent-text': 'var(--text-on-accent)',
      '--cf-border': 'var(--background-modifier-border)', '--cf-border-strong': 'var(--background-modifier-border-hover)',
      '--cf-accent-soft': 'color-mix(in srgb, var(--interactive-accent) 16%, transparent)' };
    for (const [name, value] of Object.entries(aliases)) root.style.setProperty(name, value);
    root.dataset.nativePalette = theme;
  }, wrapColumns: () => {
    const buckets = store.state!.projects?.find(item => item.id === project.id)?.settings.workflow?.buckets;
    if (!buckets) throw new Error('The explicit board buckets are required.');
    buckets[0]!.name = 'Incoming requests with a wrapped heading';
    buckets[0]!.description = 'Inspect the current request and retain its result before continuing. ' + 'LongBucketReference'.repeat(8);
  }, checkpoint: () => JSON.stringify({ status: store.state!.ideas[0]!.status, run: store.state!.ideas[0]!.workflowRun }),
    get providerCalls() { return providerCalls; }, destroy: () => { app.unmount(); store.dispose(); disposePinia(pinia); root.remove(); delete window.coforgePolishingCardProof; } };
}
void mountProof();
