import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { omit } from '../../../features/coforge/domain/objects';
import type { DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
export function durableRequest(): DurableBuildRequest {
  const idea = createSeed().ideas.find(item => item.status === 'inbox')!;
  const policy = { mode: 'background' as const, idleWarningSeconds: 1800 };
  const settings = { ...defaultSettings(), provider: 'claude' as const };
  const integration = defaultIntegration();
  return { protectedProjectPaths: [], version: 1, jobId: 'job-one', projectId: idea.projectId ?? 'CFP-001', ideaId: idea.id, runId: 'run-one', attemptId: 'attempt-one', policy,
    input: { jobId: 'job-one', stage: 'implement', idea: omit(idea, 'workflowRun', 'workflowHistory', 'increment'), settings,
      integration: { projectPath: '/synthetic/worker-project', worktreeFolder: '', allowImplementation: true, claudeBin: integration.claudeBin, ideasFolder: integration.ideasFolder, publicFolder: integration.publicFolder },
      workflow: { runId: 'run-one', definitionRevision: 'definition-one', proposalRevision: 'proposal-one', attemptId: 'attempt-one', inputArtifacts: [],
        step: { id: 'build', name: 'Build', kind: 'ai', provider: 'claude', model: settings.model, instructions: 'Build the captured change.', automatic: false, output: 'codechange', access: 'editworktree', execution: policy } } } };
}
