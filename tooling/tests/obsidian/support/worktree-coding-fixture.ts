import { parse, stringify } from 'yaml';
import { record } from '../../../../src/plugin/features/coforge/domain/check';
import { parsePersistedStudio } from '../../../../src/plugin/features/coforge/domain/persisted';
import { defaultSettings } from '../../../../src/plugin/features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../../src/plugin/features/coforge/domain/configured-workflow';
import { ideaProperties, parseIdeaNote } from '../../../../src/plugin/features/coforge/domain/idea-note';
import { workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact } from '../../../../src/plugin/features/coforge/domain/configured-workflow-run';
import { workflowIntegrityKey, workflowMetadataFingerprint } from '../../../../src/plugin/features/coforge/application/workflow-note-integrity';
import { ideaFingerprint } from '../../../../src/plugin/features/coforge/domain/integrity';
import { appendAgentSessionEvent } from '../../../../src/plugin/features/coforge/domain/agent-session';
import type { AgentJob, Idea, Increment } from '../../../../src/plugin/features/coforge/domain/types';
import { splitNote } from '../../../../src/plugin/infrastructure/coforge/markdown';

/** Synthetic historical evidence only: no provider, project command or Docker container is started. */
export function worktreeCodingFixture(noteText: string, stateText: string) {
  const data = parsePersistedStudio(JSON.parse(stateText)); const split = splitNote(noteText);
  const original = record(parse(split.yaml ?? ''));
  const idea: Idea = { ...parseIdeaNote(original, split.body), voters: [], status: 'review' };
  const at = '2026-11-01T15:00:00Z'; const proposalRevision = workflowProposalRevision(idea);
  const definition = defaultWorkflowDefinition(defaultSettings());
  const originalBuild = definition.steps.find(step => step.kind === 'ai' && step.output === 'codechange');
  if (!originalBuild || originalBuild.kind !== 'ai') throw new Error('Missing default Build.');
  const step = { ...originalBuild, id: 'build', name: 'SYNTHETIC Build', provider: 'codex' as const, inputs: [] };
  definition.steps = [step]; definition.revision = 'synthetic-coding-profile-v1';
  const increment: Increment = { summary: 'SYNTHETIC renderer fixture; no project files changed.',
    files: [{ path: 'fixture.ts', additions: 1, deletions: 0 }], diff: '+// SYNTHETIC literal diff; no code executed',
    tests: ['SYNTHETIC written note, separate from observed execution.'], simulated: false, createdAt: at };
  const artifact: WorkflowArtifact = { id: 'synthetic-host-snapshot', runId: 'synthetic-coding-run', stepId: step.id, attemptId: 'attempt-native',
    proposalRevision, output: 'codechange', createdAt: at, summary: increment.summary, increment, hostSnapshot: true, contentHash: '' };
  artifact.contentHash = workflowArtifactHash(artifact);
  idea.increment = increment;
  idea.workflowRun = { id: 'synthetic-coding-run', ideaId: idea.id, projectId: idea.projectId!, definition, proposalRevision,
    revision: 1, cursor: 1, state: 'awaiting-review', createdAt: at, updatedAt: at, artifacts: [artifact],
    attempts: ['legacy','mcp','native'].map(id => ({ id: `attempt-${id}`, jobId: `synthetic-${id}`, stepId: step.id, stepName: step.name, kind: 'ai',
      status: 'succeeded', inputs: [], startedAt: at, finishedAt: at })) };
  const job = (id: string): AgentJob => ({ id: `synthetic-${id}`, ideaId: idea.id, projectId: idea.projectId, stage: 'implement', provider: 'codex',
    model: 'synthetic-captured-model', status: 'succeeded', startedAt: at, finishedAt: at, logs: [],
    workflow: { runId: idea.workflowRun!.id, attemptId: `attempt-${id}`, definitionRevision: definition.revision, proposalRevision, step, inputArtifacts: [] } });
  const native = job('native'); native.workflow!.worktreeCoding = { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 };
  native.sessionTrace = appendAgentSessionEvent(undefined, { kind: 'tool', tool: 'shell', status: 'completed', text: '<script>SYNTHETIC provider tool output; exit and source comparison not independently captured</script>' }, at);
  const mcp = job('mcp'); mcp.provider = 'mcp'; mcp.workflow!.worktreeCoding = { version: 1, profile: 'mcp-worktree-v1' };
  mcp.sessionTrace = appendAgentSessionEvent(undefined, { kind: 'tool', tool: 'coforge_run_command', status: 'completed', text: 'SYNTHETIC host MCP command event: exit 0, no actual command executed by this fixture.' }, at);
  const legacy = job('legacy'); const command = { id: 'fixture-check', label: 'SYNTHETIC isolated check', executable: 'node', args: ['fixture.cjs'] };
  legacy.workflow!.step = { ...step, nativeTools: { verification: { commandIds: [command.id] } } };
  legacy.workflow!.verificationProfile = { enabled: true, dockerBin: 'docker', imageId: 'sha256:' + 'a'.repeat(64), timeoutSeconds: 30, maxRuns: 1, commands: [command] };
  legacy.verification = [{ id: 'synthetic-legacy-record', runId: idea.workflowRun.id, attemptId: 'attempt-legacy', projectId: idea.projectId!, commandId: command.id,
    label: command.label, executable: command.executable, args: command.args, runtime: 'docker', imageId: legacy.workflow!.verificationProfile.imageId,
    sourceHash: 'b'.repeat(64), startedAt: at, finishedAt: at, status: 'completed', exitCode: 0,
    output: 'SYNTHETIC historical Docker record; no Docker command was actually executed.', truncated: false }];
  const preparedNote = `---\n${stringify({ ...original, ...ideaProperties(idea, 'Synthetic renderer owner') })}---\n${split.body}`;
  const reread = parseIdeaNote(record(parse(splitNote(preparedNote).yaml ?? '')), split.body);
  data.jobs = [legacy, mcp, native]; data.increments[idea.id] = increment;
  data.integrity[idea.id] = ideaFingerprint(reread); data.integrity[workflowIntegrityKey(idea)] = workflowMetadataFingerprint(reread);
  return { noteText: preparedNote, stateText: JSON.stringify(parsePersistedStudio(JSON.parse(JSON.stringify(data))), null, 2) };
}
