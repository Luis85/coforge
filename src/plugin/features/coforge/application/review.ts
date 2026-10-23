import { StudioError } from '../domain/errors';
import type { AgentStage, Idea, IdeaAction, RiceScore } from '../domain/types';
import { riceValue } from '../domain/types';
import { isActiveJob } from '../domain/workflow';
import type { InternalState } from './ports';
import { addEvent } from './studio-store';

/** Streamer decisions: accept, request changes, archive or clear a moderation flag. The final decision is always manual. */
export function applyReview(state: InternalState, ideaId: string, action: Exclude<IdeaAction, AgentStage>, note: string): Idea {
  const idea = state.ideas.find(i => i.id === ideaId);
  if (!idea) throw new StudioError('Idea not found.', 404);
  if (state.jobs.some(j => j.ideaId === ideaId && isActiveJob(j))) throw new StudioError('Cancel or finish this idea’s agent job before reviewing it.', 409);
  const text = note.trim();
  if (action === 'approve') {
    if (idea.status !== 'review' || !idea.increment) throw new StudioError('Only a completed increment in review can be accepted.', 409);
    idea.status = 'shipped';
    idea.reviewNote = text || 'Accepted by the streamer.';
    addEvent(state, 'review', `${ideaId} accepted by the streamer. ${idea.increment.simulated ? 'Demo increment; no files were merged.' : 'Git merge and release remain manual.'}`, ideaId);
  } else if (action === 'changes') {
    if (idea.status !== 'review') throw new StudioError('Changes can only be requested during increment review.', 409);
    if (text.length < 3) throw new StudioError('Describe the changes you want before returning this increment.');
    idea.status = 'planned';
    idea.reviewNote = text;
    if (!state.manualHolds.includes(ideaId)) state.manualHolds.push(ideaId);
    addEvent(state, 'review', `Changes requested for ${ideaId}: ${text}. Waiting for a manual Build.`, ideaId);
  } else if (action === 'unflag') {
    if (idea.status !== 'flagged') throw new StudioError('Only a flagged idea needs a moderation override.', 409);
    if (text.length < 3) throw new StudioError('Record why this request can safely proceed.');
    idea.status = 'screened';
    idea.reviewNote = text;
    idea.screening = {
      verdict: 'clear', reason: `Human moderation override: ${text}`, signals: idea.screening?.signals ?? [],
      checkedAt: new Date().toISOString(), provider: idea.screening?.provider ?? state.settings.provider,
    };
    addEvent(state, 'review', `${ideaId} cleared by the streamer after moderation: ${text}`, ideaId);
  } else {
    if (idea.status === 'shipped') throw new StudioError('Accepted increments remain in the project history.', 409);
    idea.status = 'rejected';
    idea.reviewNote = text || 'Archived by the streamer.';
    addEvent(state, 'review', `${ideaId} archived. ${idea.reviewNote}`, ideaId);
  }
  delete idea.lastError;
  idea.updatedAt = new Date().toISOString();
  return idea;
}

/** The streamer can adjust a saved RICE estimate while no work runs and before acceptance. */
export function adjustRice(state: InternalState, ideaId: string, rice: Omit<RiceScore, 'score'>): Idea {
  const idea = state.ideas.find(i => i.id === ideaId);
  if (!idea) throw new StudioError('Idea not found.', 404);
  if (!idea.rice || idea.screening?.verdict !== 'clear') throw new StudioError('Complete the scoring stage before adjusting its estimate.', 409);
  if (['building', 'shipped', 'rejected', 'flagged'].includes(idea.status) || state.jobs.some(j => j.ideaId === idea.id && isActiveJob(j)))
    throw new StudioError('The estimate is locked while work is running or after acceptance.', 409);
  idea.rice = { ...rice, score: riceValue(rice) };
  idea.updatedAt = new Date().toISOString();
  addEvent(state, 'review', `The streamer adjusted ${idea.id}’s RICE estimate to ${idea.rice.score}.`, idea.id);
  return idea;
}
