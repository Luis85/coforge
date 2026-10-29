import type { AppState } from './types';
import { buildPublicBoard } from './public-board';
import { projectIsPublic, publicRecognitionState } from './project-publicity';
import { IntegrationFailure } from './integration-failure';
import type { ObsOverlayDefinition, ObsOverlayNowPlaying } from './obs-overlay';
import { buildCommunity } from './recognition';
export function overlayPublicContributors(state: AppState) {
  return buildCommunity(publicRecognitionState(state)).filter(profile => (profile.ideas > 0 || profile.votesCast > 0) && profile.earnedBadges.length > 0)
    .map(profile => ({ id: profile.contributor.id, name: profile.contributor.name, ideas: profile.ideas, implementations: profile.implementations, badges: profile.earnedBadges.map(badge => badge.title) }));
}
export function overlayPublicBoard(state: AppState, projectId: string) {
  if (!projectIsPublic(state, projectId)) throw new IntegrationFailure('validation', 'Choose an available public project for this overlay.');
  const project = state.projects?.find(project => project.id === projectId);
  const board = buildPublicBoard({ ...state, activeProjectId: projectId, settings: project?.settings ?? state.settings });
  if (board.projectId !== projectId) throw new IntegrationFailure('validation', 'The selected public project is unavailable.');
  return board;
}
/** Render only the established public projection, or explicitly reviewed authored text/music metadata. */
export function overlayText(state: AppState, definition: ObsOverlayDefinition, nowPlaying: ObsOverlayNowPlaying | null): string {
  const board = overlayPublicBoard(state, definition.projectId);
  let value: string;
  if (definition.kind === 'request' || definition.kind === 'increment') {
    const idea = board.columns.flatMap(column => column.ideas).find(idea => idea.id === definition.subjectId);
    if (!idea || definition.kind === 'increment' && idea.column !== 'done')
      throw new IntegrationFailure('validation', 'The selected screened public request or accepted increment is unavailable.');
    value = definition.kind === 'request'
      ? `${board.project}\n${idea.id} · ${idea.title}\nRequested by ${idea.author} · ${idea.votes} votes`
      : `${board.project}\nAccepted: ${idea.id} · ${idea.title}\nThanks, ${idea.author}!`;
  } else if (definition.kind === 'recognition') {
    const contributor = overlayPublicContributors(state).find(person => person.id === definition.subjectId);
    if (!contributor) throw new IntegrationFailure('validation', 'Choose a contributor available in public community recognition.');
    value = `${contributor.name}\n${contributor.implementations} accepted contributions · ${contributor.ideas} ideas\n${contributor.badges.join(' · ')}`;
  } else if (definition.kind === 'now-playing') {
    if (!nowPlaying?.title) throw new IntegrationFailure('validation', 'No reviewed local track is playing.');
    value = `${nowPlaying.title}${nowPlaying.artist ? ' — ' + nowPlaying.artist : ''}${nowPlaying.attribution ? '\n' + nowPlaying.attribution : ''}`;
  } else {
    if (!definition.publicConfirmed || !definition.excerpt?.trim()) throw new IntegrationFailure('validation', 'Write and explicitly approve the Council excerpt for public display.');
    value = `${board.project}\nCouncil excerpt\n${definition.excerpt}`;
  }
  const unsupportedControl = [...value].some(character => {
    const code = character.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  });
  if (!value || value.length > 4000 || unsupportedControl)
    throw new IntegrationFailure('validation', 'The public overlay text is empty, oversized or contains unsupported control characters.');
  return value;
}
