import type { ParsedCommand } from '../domain/commands';
import { projectIsPublic, requestIsPublic } from '../domain/project-publicity';
import { ideaProjectId } from '../domain/projects';
import type { InternalState } from './ports';
import type { Player } from '../domain/population';

export function publicTargetAvailable(state: InternalState, command: ParsedCommand): boolean {
  if (command.type === 'request' || command.type === 'bug') return projectIsPublic(state, command.projectId);
  if (command.type === 'vote' || command.type === 'context' || command.type === 'status') {
    const idea = state.ideas.find(item => item.id === command.ideaId);
    return Boolean(idea && requestIsPublic(state, idea));
  }
  return true;
}
export function publicReplyProjects(state: InternalState, command: ParsedCommand): string[] {
  if (!publicTargetAvailable(state, command)) return [];
  if (command.type === 'request' || command.type === 'bug') return [command.projectId];
  if (command.type === 'vote' || command.type === 'context' || command.type === 'status') {
    const idea = state.ideas.find(item => item.id === command.ideaId);
    return idea ? [ideaProjectId(idea)] : [];
  }
  return command.type === 'projects' || command.type === 'me' || command.type === 'shop' ? state.projects.filter(project => projectIsPublic(state, project.id)).map(project => project.id) : [];
}
/** Historical reward amounts cannot safely be guessed from today's earning rules. */
export function publicProgressVisible(state: InternalState, player: Player): boolean {
  const ideas = new Map(state.ideas.map(idea => [idea.id, idea]));
  return !player.rewardClaims.some(claim => {
    const id = /^(?:screened|accepted|command):(CF-\d+)$/u.exec(claim)?.[1];
    if (!id) return false;
    const idea = ideas.get(id);
    return !idea || !requestIsPublic(state, idea);
  }) && !state.population.rewards.some(reward => {
    if (reward.playerId !== player.id || !reward.ideaId) return false;
    const idea = ideas.get(reward.ideaId);
    return !idea || !requestIsPublic(state, idea);
  });
}
