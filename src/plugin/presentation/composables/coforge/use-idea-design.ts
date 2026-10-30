import { computed, reactive } from 'vue';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { workflowArtifactCheck, workflowProposalRevision, type WorkflowArtifact } from '../../../features/coforge/domain/configured-workflow-run';
import type { Idea } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { formatTime } from './format';

/** The current request's successful, intact specification; old evidence stays in Workflow runs. */
export function currentDesignSpecification(idea: Idea): WorkflowArtifact | undefined {
  const run = idea.workflowRun;
  if (!run || run.ideaId !== idea.id || run.projectId !== ideaProjectId(idea) || run.proposalRevision !== workflowProposalRevision(idea)) return;
  const invalidated = new Set(run.invalidatedArtifactIds);
  for (const artifact of [...run.artifacts].reverse()) {
    if (artifact.output !== 'design' || invalidated.has(artifact.id) || artifact.runId !== run.id || artifact.proposalRevision !== run.proposalRevision) continue;
    const producer = run.definition.steps.findIndex(step => step.id === artifact.stepId && step.kind === 'ai' && step.output === 'design');
    if (producer < 0 || producer >= run.cursor || !run.attempts.some(attempt => attempt.id === artifact.attemptId && attempt.stepId === artifact.stepId && attempt.status === 'succeeded')) continue;
    try { return workflowArtifactCheck(artifact); } catch { /* Invalid evidence remains inspectable in its workflow history. */ }
  }
}

export function useIdeaDesign(props: { idea: Idea }) {
  const store = useStudioStore();
  const specification = computed(() => currentDesignSpecification(props.idea));
  async function copy(): Promise<void> {
    const text = specification.value?.markdown;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      store.notify(`Design specification for ${props.idea.id} copied as Markdown.`);
    } catch { store.notify('The specification could not be copied. Open Workflow runs to read the saved Design result.', true); }
  }
  return reactive({
    markdown: computed(() => specification.value?.markdown ?? ''),
    savedLabel: computed(() => specification.value ? `Private design saved with ${props.idea.id} · ${formatTime(specification.value.createdAt)}` : ''),
    copy: () => { void copy(); },
  });
}
