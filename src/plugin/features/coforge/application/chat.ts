import { identity, parseCommand } from '../domain/commands';
import { viewerHelp } from '../domain/viewer-help';
import { StudioError } from '../domain/errors';
import { buildCommunity } from '../domain/recognition';
import { cleanLine, cleanText, comparable, displayName, meaningful, sanitizeText } from '../domain/sanitize';
import type { Category, ChatMessage, ChatSource, Idea } from '../domain/types';
import { CONTRIBUTOR_COLORS, ideaIdFor } from '../domain/types';
import { requestCategoryNames } from '../domain/request-categories';
import type { InternalState } from './ports';
import { addEvent, type StudioStore } from './studio-store';
import { findProject, projectIdeas, projectSettings } from '../domain/projects';
import { observePlayer, participationProblem, recordOperation, registerPlayer } from './population';
import { playerRank, playerRestricted } from '../domain/population';
import { achievedRank } from '../domain/community-environment';
import { addRequestContext } from './request-context';
import { contextEventId } from '../domain/integrity';
import { captureRequestObject, requestObjectRevision } from '../domain/request-object';
import { projectIsPublic, publicRecognitionState, PUBLIC_UNAVAILABLE, requestIsPublic } from '../domain/project-publicity';
import { economyCatalog } from './economy-catalog';
import { isEconomyCommand, settleEconomyCommand } from './command-economy';
import type { EconomyReservationPort } from '../domain/command-economy';
import { publicProgressVisible, publicReplyProjects, publicTargetAvailable } from './public-command-policy';

export interface ChatInput { username: string; userId?: string; text: string; source?: ChatSource; messageId?: string; channelId?: string; sentAt?: string }
export interface ChatResult { ok: boolean; message: string; ideaId?: string; duplicate?: boolean }
type Person = Pick<ChatInput, 'username' | 'userId' | 'source'>;

function ensureContributor(state: InternalState, raw: Person): string {
  const input = { ...raw, username: cleanLine(raw.username, 50), ...(raw.userId === undefined ? {} : { userId: cleanLine(raw.userId, 100) }) };
  if (!input.username) throw new StudioError('A username of 1–50 characters is required.');
  const id = identity(input);
  const contributor = state.contributors.find(c => c.id === id);
  if (contributor) contributor.name = input.username;
  else state.contributors.push({
    id, name: input.username, color: CONTRIBUTOR_COLORS[state.contributors.length % CONTRIBUTOR_COLORS.length]!, joinedAt: new Date().toISOString(),
  });
  return id;
}

export function createIdea(state: InternalState, input: Person & { title: string; description: string; category?: Category; projectId?: string; requestKind?: 'feature' | 'bug'; requestValues?: unknown; requestObjectRevision?: string }, origin: import('../domain/example-content').RequestOrigin = 'manual'): Idea {
  const projectId = input.projectId ?? state.activeProjectId;
  if (input.source && input.source !== 'simulator' && !projectIsPublic(state, projectId)) throw new StudioError(PUBLIC_UNAVAILABLE, 404);
  const title = cleanLine(input.title);
  const description = cleanText(input.description);
  if (title.length < 5 || title.length > 120) throw new StudioError('Idea titles must contain 5–120 characters.');
  if (description.length > 3000) throw new StudioError('Keep the description under 3,000 characters.');
  if (findProject(state, projectId).unavailable) throw new StudioError('Restore the project note before adding requests.', 409);
  const definition = projectSettings(state, projectId).requestObject;
  if (input.requestObjectRevision !== undefined && input.requestObjectRevision !== requestObjectRevision(definition))
    throw new StudioError('This project\'s request fields changed. Review the current class and fields before creating the request; your draft was not written.', 409);
  const requestObject = captureRequestObject(definition, input.requestValues);
  const categories = requestCategoryNames(requestObject ?? definition);
  const category = input.category ?? categories[0]!;
  if (!categories.includes(category)) throw new StudioError('Choose a category configured for this project’s request object.');
  if (projectIdeas(state, projectId).length >= 5000) throw new StudioError('This project has reached its 5,000-idea limit. Export the project before starting a new one.', 409);
  const authorId = ensureContributor(state, input);
  const number = state.nextIdeaNumber++;
  const now = new Date().toISOString();
  const idea: Idea = {
    id: ideaIdFor(number), number, projectId, title, description: description || title, authorId,
    ...(input.requestKind ? { requestKind: input.requestKind } : {}),
    ...(requestObject ? { requestObject } : {}),
    category,
    status: 'inbox', voters: [], createdAt: now, updatedAt: now,
  };
  state.ideas.push(idea);
  (state.requestOrigins ??= {})[idea.id] = origin;
  addEvent(state, 'idea', `${input.username} suggested “${idea.title}”.`, idea.id);
  return idea;
}

export function addVote(state: InternalState, ideaId: string, input: Person): ChatResult {
  const idea = state.ideas.find(i => i.id === ideaId.toUpperCase());
  if (input.source && input.source !== 'simulator' && (!idea || !requestIsPublic(state, idea))) return { ok: false, message: PUBLIC_UNAVAILABLE };
  if (!idea) return { ok: false, message: `Idea ${ideaId} does not exist. Check the ID on the board.` };
  if (idea.status === 'rejected' || idea.status === 'flagged')
    return { ok: false, message: `${idea.id} is ${idea.status === 'flagged' ? 'held for moderation' : 'archived'} and cannot receive votes.` };
  const userId = ensureContributor(state, input);
  if (idea.voters.includes(userId)) return { ok: true, duplicate: true, ideaId: idea.id, message: `Your vote for ${idea.id} is already counted.` };
  idea.voters.push(userId);
  idea.updatedAt = new Date().toISOString();
  addEvent(state, 'vote', `${input.username} voted for ${idea.id}.`, idea.id);
  return { ok: true, ideaId: idea.id, message: `Vote counted for ${idea.id} · ${idea.voters.length} votes.` };
}

/** Every chat request becomes a note in the vault, so intake is bounded per viewer and overall. */
export const INTAKE_LIMITS = { pendingPerViewer: 3, perMinute: 10 } as const;

function request(state: InternalState, input: ChatInput, userId: string, projectId: string, text: string, now: string, requestKind: 'feature' | 'bug' = 'feature'): ChatResult {
  const project = state.projects.find(project => project.id === projectId && !project.unavailable);
  if (!project) return { ok: false, message: `Project ${projectId} is not available. Use a project ID shown by the streamer.` };
  if (!meaningful(text)) return { ok: false, message: 'Describe the idea in words after !request.' };
  const player = state.population.players.find(player => player.id === userId);
  const previous = requestKind === 'feature' ? player?.lastFeatureAt : state.ingestMeta.lastRequests[`bug:${userId}`];
  const elapsed = previous ? (Date.now() - Date.parse(previous)) / 1000 : Infinity;
  const key = comparable(text);
  const duplicate = projectIdeas(state, projectId).find(i => i.status !== 'rejected' && (i.requestKind ?? 'feature') === requestKind && (comparable(i.description) === key || comparable(i.title) === key));
  if (duplicate) return { ok: true, duplicate: true, ideaId: duplicate.id, message: `That idea already exists as ${duplicate.id}. Use !vote ${duplicate.id} to support it.` };
  const cooldown = requestKind === 'feature' ? 300 : 15;
  if (elapsed < cooldown) {
    recordOperation(state, 'cooldown-rejected', 'none', userId);
    return { ok: false, message: `Please wait ${Math.ceil(cooldown - elapsed)} seconds before sending another ${requestKind === 'feature' ? 'feature request' : 'bug report'}.` };
  }
  const pending = state.ideas.filter(i => i.authorId === userId && i.status === 'inbox').length;
  if (pending >= INTAKE_LIMITS.pendingPerViewer)
    return { ok: false, message: `You already have ${pending} ideas waiting for screening. Please wait until they are reviewed.` };
  const recent = state.ideas.filter(i => Date.now() - Date.parse(i.createdAt) < 60_000).length;
  if (recent >= INTAKE_LIMITS.perMinute) return { ok: false, message: 'Lots of ideas are arriving right now. Please send yours again in a minute.' };
  const title = text.length <= 100 ? text : `${text.slice(0, 97).trimEnd()}…`;
  const source = input.source ?? 'simulator';
  const idea = createIdea(state, { title, description: text, projectId, requestKind, username: input.username, ...(input.userId ? { userId: input.userId } : {}), source }, source === 'simulator' ? 'local-test' : source);
  if (requestKind === 'feature' && player) player.lastFeatureAt = now;
  else state.ingestMeta.lastRequests[`bug:${userId}`] = now;
  recordOperation(state, requestKind === 'feature' ? 'request-created' : 'bug-created', 'committed', userId, 1, idea.id);
  return { ok: true, ideaId: idea.id, message: `Added ${idea.id} to ${projectId} · ${project.settings.projectName}. The community can now !vote ${idea.id}.` };
}

function status(state: InternalState, ideaId: string): ChatResult {
  const idea = state.ideas.find(i => i.id === ideaId);
  if (!idea) return { ok: false, message: `Idea ${ideaId} does not exist.` };
  const label = idea.status === 'shipped' ? 'accepted' : idea.status;
  return { ok: true, ideaId: idea.id, message: `${idea.id} · ${idea.title} · ${label} · ${idea.voters.length} votes${idea.plan ? ' · plan saved' : ''}${idea.lastError ? ' · run needs streamer attention' : ''}.` };
}

function me(state: InternalState, userId: string, username: string, publicOnly = false): string {
  const player = state.population.players.find(player => player.id === userId);
  if (!player?.registeredAt) return `${username}: register with !register to join The Hood.`;
  const profile = buildCommunity(publicOnly ? publicRecognitionState(state) : state).find(p => p.contributor.id === userId);
  if (!profile) return `${username}: no contributions yet.`;
  const badges = profile.earnedBadges.length ? ` (${profile.earnedBadges.map(b => b.title).join(', ')})` : '';
  if (publicOnly && !publicProgressVisible(state, player)) return `${username}: ${profile.ideas} public screened ideas · ${profile.votesReceived} public votes received · ${profile.votesCast} public ideas backed · ${profile.implementations} public accepted implementations · ${profile.earnedBadges.length} public badges${badges}. Progression details are unavailable in public chat.`;
  const environment = state.population.environment;
  return `${environment.actorName} ${username}: ${achievedRank(player.xp, environment).name} (rank ${playerRank(player, environment)}) · ${player.xp} XP · ${player.coins} ${environment.currencyName} · ${player.reputation} reputation · ${Math.floor(player.presenceSeconds / 60)} tracked chat-presence minutes · ${profile.ideas} screened ideas · ${profile.votesReceived} votes received · ${profile.votesCast} other ideas backed · ${profile.implementations} accepted implementations · ${profile.earnedBadges.length} badges${badges}.`;
}

/** Applies one chat message: commands, contributor identity, unique votes, cooldowns and event deduplication. */
export async function ingestChat(store: StudioStore, raw: ChatInput, reservations?: EconomyReservationPort): Promise<ChatResult> {
  const source = raw.source ?? 'simulator';
  if (raw.text.length > 8000) throw new StudioError('Messages must contain 1–2,000 characters.');
  // Normalize before anything else: commands, duplicate checks, heuristics, notes and model input all see the same clean text.
  const { text, removed } = sanitizeText(raw.text);
  const username = displayName(raw.username);
  if (!text || text.length > 2000) throw new StudioError('Messages must contain 1–2,000 characters.');
  if (!username || username.length > 50) throw new StudioError('A username of 1–50 characters is required.');
  const input: ChatInput = {
    ...raw, text, username,
    ...(raw.userId === undefined ? {} : { userId: cleanLine(raw.userId, 100) }), ...(raw.messageId === undefined ? {} : { messageId: cleanLine(raw.messageId, 200) }),
  };
  const parsed = parseCommand(text);
  let capturedPublicProjects: string[] = [];
  const committed = await store.transaction<ChatResult>(async state => {
    if (source === 'twitch' && input.channelId && input.channelId !== state.integration.twitchBroadcasterId)
      return { ok: false, message: 'The channel changed before this event was processed.' };
    const messageKey = input.messageId ? `${source}:${input.messageId}` : undefined;
    const removals = state.ingestMeta.chatRemovals;
    if (source === 'twitch' && removals && removals.channelId === input.channelId) {
      const sentAt = input.sentAt && Number.isFinite(Date.parse(input.sentAt)) ? Date.parse(input.sentAt) : Date.now();
      const viewer = (input.userId ?? '').replace(/^twitch:/, ''); const userClear = removals.users.find(user => user.id === viewer)?.at;
      if (input.messageId && removals.messages.includes(input.messageId) || removals.clearAt && sentAt <= Date.parse(removals.clearAt) || userClear && sentAt <= Date.parse(userClear))
        return { ok: true, duplicate: true, message: 'A removed Twitch message was not replayed.' };
    }
    const seen = messageKey ? state.ingestMeta.processedMessages.find(m => m.id === messageKey) : undefined;
    if (seen) {
      recordOperation(state, 'duplicate-event', 'none');
      if (source !== 'simulator' && seen.ideaId && !state.ideas.some(idea => idea.id === seen.ideaId && requestIsPublic(state, idea))) return { ok: false, message: PUBLIC_UNAVAILABLE };
      return { ok: true, duplicate: true, ...(seen.ideaId ? { ideaId: seen.ideaId } : {}), message: 'This chat event was already processed.' };
    }
    if (messageKey && state.population.economy?.usageTombstones[messageKey]) return { ok: true, duplicate: true, message: 'This command event was already processed. No charge or reward was repeated.' };
    const userId = ensureContributor(state, { ...input, source });
    if (parsed.type !== 'message') recordOperation(state, 'command-observed');
    if (source === 'twitch') {
      recordOperation(state, 'twitch-message-observed');
      if (parsed.type !== 'message') recordOperation(state, 'twitch-command-observed');
    }
    const now = new Date().toISOString();
    const player = observePlayer(state, userId, now);
    recordOperation(state, 'message-observed', 'committed', userId);
    const chat: ChatMessage = { id: crypto.randomUUID(), userId, username: input.username.trim(), text, createdAt: now, kind: 'message', source };
    let result: ChatResult = { ok: true, message: 'Message received.' };
    const beforeCommand = isEconomyCommand(parsed) ? structuredClone(state) : undefined;
    const problem = ['request', 'bug', 'context', 'vote'].includes(parsed.type) ? participationProblem(state, userId) : null;
    if (source !== 'simulator' && !publicTargetAvailable(state, parsed)) { result = { ok: false, message: PUBLIC_UNAVAILABLE }; chat.kind = 'error'; }
    else if (parsed.type === 'register') result = registerPlayer(state, userId, now);
    else if (problem) { result = { ok: false, message: problem }; chat.kind = 'error'; recordOperation(state, 'participation-rejected', 'none', userId); }
    else if (parsed.type === 'request' || parsed.type === 'bug') { result = request(state, { ...input, source }, userId, parsed.projectId, parsed.text, now, parsed.type === 'bug' ? 'bug' : 'feature'); chat.kind = result.ok ? 'request' : 'error'; }
    else if (parsed.type === 'vote') { result = addVote(state, parsed.ideaId, { ...input, source }); chat.kind = result.ok ? 'vote' : 'error'; if (result.ok && !result.duplicate) recordOperation(state, 'vote-counted', 'committed', userId, 1, parsed.ideaId); }
    else if (parsed.type === 'context') { result = addRequestContext(state, parsed.ideaId, parsed.text, userId, username, now, messageKey ? contextEventId(messageKey) : undefined); chat.kind = result.ok ? 'context' : 'error'; }
    else if (parsed.type === 'shop' || parsed.type === 'odds' || parsed.type === 'redeem' || parsed.type === 'lootbox') result = economyCatalog(state, parsed, userId, source !== 'simulator');
    else if (parsed.type === 'invalid') { result = { ok: false, message: parsed.message }; chat.kind = 'error'; }
    else if (parsed.type === 'help') result.message = viewerHelp(parsed.topic ?? 'start', state.population.environment, state.population.rules);
    else if (parsed.type === 'status') result = status(state, parsed.ideaId);
    else if (parsed.type === 'me') result.message = me(state, userId, input.username, source !== 'simulator');
    else if (parsed.type === 'ranks') {
      const ranks = state.population.environment.ranks;
      const page = Math.min(parsed.page, Math.max(1, Math.ceil(ranks.length / 5)));
      result.message = `Ranks ${page}/${Math.max(1, Math.ceil(ranks.length / 5))}: ${ranks.slice((page - 1) * 5, page * 5).map(rank => `${rank.name}: ${rank.minimumXp} XP`).join(' · ')}. Use !me for your rank and progress.`;
    }
    else if (parsed.type === 'projects') {
      const projects = state.projects.filter(project => !project.unavailable && (source === 'simulator' || projectIsPublic(state, project.id)));
      const page = Math.min(parsed.page, Math.max(1, Math.ceil(projects.length / 3)));
      result.message = projects.length ? `Projects ${page}/${Math.ceil(projects.length / 3)}: ${projects.slice((page - 1) * 3, page * 3).map(project => `${project.id}: ${project.settings.projectName}`).join(' · ')}. Use !request <project-id> <idea> or !bug <project-id> <bug>.` : 'No projects are available yet.';
    }
    const eventKey = messageKey ?? `${source}:local:${chat.id}`;
    const economyProblem = await settleEconomyCommand(state, parsed, result, { eventKey, inputIdentity: JSON.stringify([source, input.channelId ?? '', userId, parsed]), playerId: userId, source, ...(input.channelId ? { channelId: input.channelId } : {}), now }, reservations);
    if (economyProblem && beforeCommand) {
      Object.assign(state, beforeCommand);
      result = { ok: false, message: economyProblem }; chat.kind = 'error';
      await settleEconomyCommand(state, parsed, result, { eventKey, inputIdentity: '', playerId: userId, source, now });
    }
    if (!result.ok && parsed.type !== 'message') { chat.kind = 'error'; recordOperation(state, 'command-rejected', 'none', userId); }
    if (removed && parsed.type !== 'message') result.message += ' Hidden or invisible characters were removed from the message.';
    if (result.ideaId) chat.ideaId = result.ideaId;
    if (source === 'twitch' && input.messageId) chat.externalId = input.messageId;
    if (source === 'twitch' && input.channelId) chat.twitchChannelId = input.channelId;
    state.chat.push(chat);
    const greeting = parsed.type === 'message' && source === 'twitch' && state.integration.twitchBotReplies && !player.registeredAt
      && !playerRestricted(player, state.integration.twitchBroadcasterId) && (!player.greetedAt || Date.now() - Date.parse(player.greetedAt) >= 86_400_000);
    if (greeting) result.message = `Welcome ${input.username}! Type !register to join The Hood, request features, report bugs and vote. Use !help for commands.`;
    const botReply = source === 'twitch' && state.integration.twitchEnabled && state.integration.twitchBotReplies && state.integration.twitchBroadcasterId && input.messageId && (parsed.type !== 'message' || greeting);
    if (botReply && input.messageId) {
      const full = state.botReplies.filter(reply => reply.status === 'pending' || reply.status === 'sending').length >= 50;
      state.botReplies.push({ id: messageKey!, parentMessageId: input.messageId, channelId: state.integration.twitchBroadcasterId,
        publicProjectIds: publicReplyProjects(state, parsed),
        ...(greeting ? { greetingPlayerId: userId } : {}),
        senderId: state.integration.twitchBotUsesStreamer ? state.integration.twitchBroadcasterId : state.integration.twitchBotUserId,
        text: [...result.message].slice(0, 500).join(''), createdAt: now, status: full ? 'failed' : 'pending', ...(full ? { error: 'Reply queue is full.' } : {}) });
      if (greeting && !full) { player.greetedAt = now; recordOperation(state, 'greeted', 'committed', userId); }
    }
    if (parsed.type !== 'message' && !botReply) state.chat.push({
      id: crypto.randomUUID(), userId: 'system:coforge', username: 'CoForge', text: result.message, kind: result.ok ? 'system' : 'error',
      createdAt: now, source, ...(result.ideaId ? { ideaId: result.ideaId } : {}),
    });
    if (messageKey) state.ingestMeta.processedMessages.push({ id: messageKey, ...(result.ideaId ? { ideaId: result.ideaId } : {}) });
    capturedPublicProjects = publicReplyProjects(state, parsed);
    return result;
  }, isEconomyCommand(parsed) ? { atomicCommand: true } : {});
  if (source !== 'simulator' && (capturedPublicProjects.length || committed.ideaId || 'ideaId' in parsed || 'projectId' in parsed)) {
    const current = store.internalSnapshot();
    const stale = !publicTargetAvailable(current, parsed) || capturedPublicProjects.some(id => !projectIsPublic(current, id))
      || Boolean(committed.ideaId && !current.ideas.some(idea => idea.id === committed.ideaId && requestIsPublic(current, idea)));
    if (stale) return { ok: committed.ok, ...(committed.duplicate ? { duplicate: true } : {}), message: PUBLIC_UNAVAILABLE };
  }
  return committed;
}

const DEMO_REQUESTS = [
  'A little bridge over the creek', 'A quiet mode with fewer visual effects', 'Collect fallen leaves for camp decorations',
  'Let us watch the stars from our tent', 'A friendly frog near the pond', 'Remember the last selected tool',
  'A soft chime when the sun rises', 'Add a colorblind-friendly gathering highlight',
];
const DEMO_VIEWERS = ['luna_loop', 'pixelpirate', 'fernfriend', 'bytebloom', 'cozycoder', 'mothmode'];

/** A simulated viewer message: a vote, a new request or small talk. */
export async function simulateMessage(store: StudioStore, random: () => number = Math.random, reservations?: EconomyReservationPort): Promise<ChatResult> {
  const state = store.snapshot();
  const people = state.contributors.filter(c => c.id.startsWith('simulator:')).slice(0, 12);
  const user = people.length ? people[Math.floor(random() * people.length)]! : { id: '', name: DEMO_VIEWERS[Math.floor(random() * DEMO_VIEWERS.length)]! };
  const available = projectIdeas(state).filter(i => !['flagged', 'rejected'].includes(i.status) && !i.voters.includes(user.id));
  const unseen = DEMO_REQUESTS.find(title => !projectIdeas(state).some(i => i.title === title));
  const text = available.length && (!unseen || random() > 0.35) ? `!vote ${available[Math.floor(random() * available.length)]!.id}`
    : unseen ? `!request ${state.activeProjectId} ${unseen}` : 'This is becoming our favorite little game.';
  return ingestChat(store, { username: user.name, text, source: 'simulator', messageId: crypto.randomUUID(), ...(user.id ? { userId: user.id.replace(/^simulator:/, '') } : {}) }, reservations);
}
