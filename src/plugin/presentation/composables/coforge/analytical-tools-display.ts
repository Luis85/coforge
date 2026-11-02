import type { AgentJob } from '../../../features/coforge/domain/types';
import { isAnalyticalWorkflowStep } from '../../../features/coforge/domain/workflow-analytical-tools';

/** Recorded permissions are separate from authoring defaults and observed tool activity. */
export function capturedAnalyticalTools(job: AgentJob) {
  const execution = job.workflow;
  if (!execution || !isAnalyticalWorkflowStep(execution.step, job.provider)) return;
  const captured = execution.analyticalTools?.version === 1 && execution.analyticalTools.profile === 'scoped-analyst-v1';
  const policy = execution.step.nativeTools;
  const assistants = policy?.delegation;
  return {
    id: job.id, attemptId: execution.attemptId, stepName: execution.step.name,
    provider: job.provider === 'codex' ? 'Codex' : 'Claude Code',
    title: captured ? 'Scoped analytical tools' : 'Earlier restricted attempt',
    assistants: assistants ? `Native assistants allowed · ${assistants.maxConcurrent} concurrent` : assistants === false ? 'Native assistants disabled' : 'No native assistant grant recorded',
    research: captured && policy?.research === true ? 'Native web research allowed' : captured && policy?.research === false ? 'Native web research disabled' : 'No native research grant recorded',
    access: execution.step.access === 'readproject' ? 'Repository files are read-only.' : 'No repository file access.',
  };
}
