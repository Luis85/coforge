import { WORKFLOW_RUN_LIMIT_BYTES, workflowSerializedSize, workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision, type ConfiguredStepExecution, type WorkflowArtifact, type WorkflowRun } from '../domain/configured-workflow-run';
import type { AiWorkflowStep, WorkflowOutput } from '../domain/configured-workflow';
import { findProject, ideaProjectId } from '../domain/projects';
import { riceValue, type AgentJob, type AgentStage, type Idea } from '../domain/types';
import { heuristicSignals } from '../domain/workflow';
import type { InternalState, StageResult } from './ports';

export const compatibilityStage = (output: WorkflowOutput): AgentStage => output === 'screening' ? 'screen' : output === 'rice' ? 'score' : output === 'codechange' ? 'implement' : 'plan';
export function configuredIdea(state: InternalState, id: string): Idea {
  const idea = state.ideas.find(item => item.id === id);
  if (!idea) throw new Error('Request not found.');
  if (['shipped', 'rejected'].includes(idea.status)) throw new Error('This request is closed.');
  if (findProject(state, ideaProjectId(idea)).unavailable) throw new Error('Restore this project note before continuing.');
  return idea;
}
export function configuredInputs(run: WorkflowRun, step: Pick<AiWorkflowStep, 'inputs' | 'includePreviousResults'>): WorkflowArtifact[] {
  const invalid = new Set(run.invalidatedArtifactIds);
  const preceding = run.artifacts.filter(artifact => !invalid.has(artifact.id) && artifact.proposalRevision === run.proposalRevision &&
    run.definition.steps.findIndex(item => item.id === artifact.stepId) < run.cursor);
  const latest = new Map<WorkflowOutput, WorkflowArtifact>();
  for (const artifact of preceding) {
    if (artifact.output === 'codechange' && run.workspaceId && artifact.increment?.simulated) continue;
    if (artifact.output !== 'codechange' || artifact.hostSnapshot || !latest.get('codechange')?.hostSnapshot) latest.set(artifact.output, artifact);
  }
  const inputs = step.includePreviousResults || !step.inputs?.length ? [...latest.values()]
    : step.inputs.flatMap(role => { const artifact = latest.get(role); return artifact ? [artifact] : []; });
  for (const role of step.inputs ?? []) if (!inputs.some(artifact => artifact.output === role)) throw new Error(`The step requires a valid preceding ${role} artifact.`);
  return inputs.map(workflowArtifactCheck);
}
export function configuredRuntime(state: InternalState, idea: Idea, step: AiWorkflowStep, external = false): void {
  if (idea.voters.length < (step.minVotes ?? 0)) throw new Error(`This step requires ${step.minVotes} votes.`);
  if (idea.screening?.verdict === 'flagged') throw new Error('Resolve this request’s moderation flag before continuing.');
  const project = findProject(state, ideaProjectId(idea));
  if (!external && step.provider === 'demo') return;
  if (!external && step.provider === 'claude' && !state.runtime.cliAvailable) throw new Error('The native Claude runtime is unavailable.');
  if (!external && step.provider === 'codex' && !state.runtime.codexAvailable) throw new Error('The native Codex runtime is unavailable. Check Runtime settings.');
  if (!external && step.provider === 'herdr' && !state.runtime.herdrWorkflow?.ready) throw new Error(state.runtime.herdrWorkflow?.message || 'The Herdr runtime or recovery journal is not ready.');
  if (step.access !== 'none' && !project.projectPath) throw new Error('Set this project’s repository path before repository access.');
  if (step.access === 'editworktree' && !project.allowImplementation) throw new Error('Enable implementation for this project before worktree editing.');
}
export function configuredAttempt(state: InternalState, job: AgentJob, allowStopped = false) {
  const snapshot = job.workflow;
  if (!snapshot) throw new Error('The configured attempt snapshot is missing.');
  const idea = state.ideas.find(item => item.id === job.ideaId);
  const run = idea?.workflowRun;
  const attempt = run?.attempts.find(item => item.id === snapshot.attemptId);
  if (!idea || !run || !attempt || ideaProjectId(idea) !== job.projectId || run.ideaId !== idea.id || run.projectId !== ideaProjectId(idea) ||
      run.id !== snapshot.runId || run.definition.revision !== snapshot.definitionRevision || run.activeAttemptId !== attempt.id ||
      workflowProposalRevision(idea) !== snapshot.proposalRevision || run.proposalRevision !== snapshot.proposalRevision ||
      JSON.stringify(run.definition.steps[run.cursor]) !== JSON.stringify(snapshot.step) || (!allowStopped && run.state !== 'running'))
    throw new Error('The request, workflow or active step changed. Its result cannot advance this run.');
  for (const input of snapshot.inputArtifacts) {
    const current = run.artifacts.find(item => item.id === input.id);
    if (!current || run.invalidatedArtifactIds?.includes(input.id) || workflowArtifactHash(current) !== input.contentHash || current.contentHash !== input.contentHash)
      throw new Error('A bound workflow input changed. Its result cannot advance this run.');
  }
  const template = run.outputTemplates?.find(item => item.id === snapshot.step.outputTemplateId);
  if (JSON.stringify(template) !== JSON.stringify(snapshot.outputTemplate)) throw new Error('The captured output template changed. Its result cannot advance this run.');
  return { idea, run, attempt, snapshot };
}
/** Host-captured files remain attributable even when semantic inputs changed or the run was stopped. */
export function configuredChanges(state: InternalState, job: AgentJob) {
  const trusted = state.jobs.find(item => item.id === job.id);
  const snapshot = trusted?.workflow;
  const idea = state.ideas.find(item => item.id === job.ideaId);
  const run = idea && snapshot && idea.workflowRun?.id === snapshot.runId ? idea.workflowRun : idea?.workflowHistory?.find(item => item.id === snapshot?.runId);
  const attempt = run?.attempts.find(item => item.id === snapshot?.attemptId);
  if (!trusted || !snapshot || !idea || !run || !attempt || trusted.projectId !== run.projectId || run.ideaId !== job.ideaId ||
      attempt.jobId !== job.id || attempt.stepId !== snapshot.step.id || run.definition.revision !== snapshot.definitionRevision ||
      run.proposalRevision !== snapshot.proposalRevision || (snapshot.workspaceId && snapshot.workspaceId !== run.workspaceId))
    throw new Error('The original workflow resource identity changed; inspect its private workspace journal.');
  return { idea, run, snapshot };
}
type ArtifactPayload = Partial<Pick<WorkflowArtifact, 'markdown' | 'screening' | 'rice' | 'plan' | 'increment' | 'summary' | 'hostSnapshot'>> & { output: WorkflowOutput };
export function appendWorkflowArtifact(run: WorkflowRun, snapshot: ConfiguredStepExecution, payload: ArtifactPayload, now: string): WorkflowArtifact {
  const value = { id: crypto.randomUUID(), runId: run.id, stepId: snapshot.step.id, attemptId: snapshot.attemptId, proposalRevision: run.proposalRevision, createdAt: now, ...payload };
  const complete = workflowArtifactCheck({ ...value, contentHash: workflowArtifactHash(value) });
  if (run.artifacts.length >= 200) throw new Error('This run has reached its artifact limit. Preserve its history and start a new run.');
  if (workflowSerializedSize({ ...run, artifacts: [...run.artifacts, complete] }) > WORKFLOW_RUN_LIMIT_BYTES) throw new Error('This run exceeds its evidence size limit. Preserve/export the original workspace and start a fresh run; nothing was truncated.');
  run.artifacts.push(complete);
  return complete;
}
export function projectWorkflowChanges(idea: Idea, run: WorkflowRun): void {
  const latest = [...run.artifacts].reverse().find(item => item.output === 'codechange' && item.hostSnapshot &&
    (!run.workspaceId || !item.increment?.simulated) && !run.invalidatedArtifactIds?.includes(item.id));
  if (latest?.increment?.files.length) { idea.increment = latest.increment; idea.status = 'review'; }
  else if (latest || (run.workspaceId && idea.increment?.simulated)) {
    delete idea.increment;
    idea.status = idea.screening?.verdict === 'flagged' ? 'flagged' : idea.plan ? 'planned' : idea.rice ? 'ranked' : idea.screening?.verdict === 'clear' ? 'screened' : 'inbox';
  }
}
export function applyConfiguredOutput(idea: Idea, run: WorkflowRun, snapshot: ConfiguredStepExecution, result: StageResult, provider: AgentJob['provider'], now: string): void {
  const output = snapshot.step.output;
  const captured = [...run.artifacts].reverse().find(item => item.output === 'codechange' && item.hostSnapshot && item.attemptId === snapshot.attemptId);
  const changes = captured ? captured.increment : result.increment;
  if (snapshot.step.access === 'editworktree' && provider !== 'demo' && !captured && !result.increment)
    throw new Error('A verified cumulative workspace capture is required before this editing step can complete.');
  let payload: ArtifactPayload;
  if (output === 'markdown' || output === 'design') payload = { output, markdown: result.markdown };
  else if (output === 'screening') payload = { output, screening: result.screening ? { ...result.screening, provider } : undefined };
  else if (output === 'rice') payload = { output, rice: result.rice ? { ...result.rice, score: riceValue(result.rice) } : undefined };
  else if (output === 'plan') payload = { output, plan: result.plan };
  else payload = { output, summary: result.summary ?? changes?.summary ?? 'No code changes were produced.', ...(changes ? { increment: changes } : {}) };
  const artifact = appendWorkflowArtifact(run, snapshot, payload, now);
  if (artifact.screening) {
    const signals = heuristicSignals(`${idea.title}\n${idea.description}\n${idea.requestObject ? JSON.stringify(idea.requestObject) : ''}\n${idea.contexts?.map(item => item.text).join('\n') ?? ''}`);
    idea.screening = signals.length ? { ...artifact.screening, verdict: 'flagged', signals: [...new Set([...artifact.screening.signals, ...signals])] } : artifact.screening;
  }
  if (artifact.rice) idea.rice = artifact.rice;
  if (artifact.plan) idea.plan = artifact.plan;
  if (!captured && changes) appendWorkflowArtifact(run, snapshot,
    { output: 'codechange', hostSnapshot: true, summary: changes.summary, increment: changes }, now);
  projectWorkflowChanges(idea, run);
  if (!idea.increment) idea.status = idea.screening?.verdict === 'flagged' ? 'flagged' : idea.plan ? 'planned' : idea.rice ? 'ranked' : idea.screening?.verdict === 'clear' ? 'screened' : 'inbox';
}
