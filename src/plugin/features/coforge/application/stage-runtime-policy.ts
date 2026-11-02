import { StudioError } from '../domain/errors';
import type { AgentStage } from '../domain/types';
import { findProject, projectSettings } from '../domain/projects';
import { stageAgent } from '../domain/stage-agents';
import type { InternalState } from './ports';

export function assertStageRuntime(state: InternalState, stage: AgentStage, projectId: string, provider = stageAgent(projectSettings(state, projectId), stage).provider): void {
  const project = findProject(state, projectId);
  if (project.unavailable) throw new StudioError('Restore this project note before running agents.', 409);
  if (provider === 'herdr') {
    if (!state.runtime.herdrWorkflow?.ready) throw new StudioError(state.runtime.herdrWorkflow?.message || 'Connect Herdr and load its recovery journals before running workflow steps.', 409);
    if (!project.projectPath) throw new StudioError('Set this project’s workspace before running Herdr workflow steps.', 409);
    if (stage === 'implement' && !project.allowImplementation) throw new StudioError('Real implementation is disabled for this project.', 409);
    return;
  }
  if (provider !== 'claude' && provider !== 'codex') return;
  if (provider === 'codex' && !state.runtime.codexAvailable) throw new StudioError('Codex CLI is not available. Install it, sign in locally, then check Runtime settings.', 409);
  if (provider === 'claude' && !state.runtime.cliAvailable) throw new StudioError('Claude Code CLI is not available. Install it, sign in locally, then check the runtime in CoForge settings.', 409);
  if (!project.projectPath && (stage === 'plan' || stage === 'implement'))
    throw new StudioError('Set this project’s repository path in Project settings before planning or building.', 409);
  if (stage === 'implement' && !project.allowImplementation)
    throw new StudioError('Real implementation is disabled. Enable it for this project in Project settings after reviewing the integration guide.', 409);
}
