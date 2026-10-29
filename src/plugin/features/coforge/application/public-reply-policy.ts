import type { BotReply } from '../domain/twitch';
import { projectIsPublic } from '../domain/project-publicity';
import type { InternalState } from './ports';
import { recordOperation } from './population';

export function publicReplyBlocked(state: InternalState, reply: BotReply): boolean {
  if (reply.streamMessageId) return false;
  if (reply.publicProjectIds) return reply.publicProjectIds.some(id => !projectIsPublic(state, id));
  return Boolean(state.runtime.publicationDeniedProjectIds?.length || state.projects.some(project => !projectIsPublic(state, project.id)));
}
/** Unsent derived replies cannot retain a stale public project snapshot after revocation. */
export function cancelPrivateReplies(state: InternalState): void {
  for (const reply of state.botReplies) {
    if (!publicReplyBlocked(state, reply)) continue;
    if (reply.status === 'sending') throw new Error('Wait for the in-flight bot delivery to settle before changing project visibility. No delivery is replayed.');
    if (reply.status !== 'pending') continue;
    reply.status = 'cancelled'; reply.error = 'The derived reply was cancelled because project publication is unavailable.';
    recordOperation(state, 'reply-privacy-cancelled', 'none');
  }
}
