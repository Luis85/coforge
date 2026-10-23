import { HELP_TEXT, identity, parseCommand } from '../domain/commands';
import { StudioError } from '../domain/errors';
import { buildCommunity } from '../domain/recognition';
import { cleanLine, cleanText, sanitizeText } from '../domain/sanitize';
import type { Category, ChatMessage, ChatSource, Idea } from '../domain/types';
import { CATEGORIES, CONTRIBUTOR_COLORS, ideaIdFor } from '../domain/types';
import type { InternalState } from './ports';
import { addEvent, type StudioStore } from './studio-store';

export interface ChatInput { username: string; userId?: string; text: string; source?: ChatSource; messageId?: string }
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

export function createIdea(state: InternalState, input: Person & { title: string; description: string; category?: Category }): Idea {
  const title = cleanLine(input.title);
  const description = cleanText(input.description);
  if (title.length < 5 || title.length > 120) throw new StudioError('Idea titles must contain 5–120 characters.');
  if (description.length > 3000) throw new StudioError('Keep the description under 3,000 characters.');
  if (state.ideas.length >= 5000) throw new StudioError('This project has reached its 5,000-idea limit. Export the project before starting a new one.', 409);
  const authorId = ensureContributor(state, input);
  const number = state.nextIdeaNumber++;
  const now = new Date().toISOString();
  const idea: Idea = {
    id: ideaIdFor(number), number, title, description: description || title, authorId,
    category: input.category && CATEGORIES.includes(input.category) ? input.category : 'Gameplay',
    status: 'inbox', voters: [], createdAt: now, updatedAt: now,
  };
  state.ideas.push(idea);
  addEvent(state, 'idea', `${input.username} suggested “${idea.title}”.`, idea.id);
  return idea;
}

export function addVote(state: InternalState, ideaId: string, input: Person): ChatResult {
  const idea = state.ideas.find(i => i.id === ideaId.toUpperCase());
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

function request(state: InternalState, input: ChatInput, userId: string, text: string, now: string): ChatResult {
  const previous = state.ingestMeta.lastRequests[userId];
  const elapsed = previous ? (Date.now() - Date.parse(previous)) / 1000 : Infinity;
  const duplicate = state.ideas.find(i => i.description.trim().toLocaleLowerCase('en-US') === text.toLocaleLowerCase('en-US') && i.status !== 'rejected');
  if (duplicate) return { ok: true, duplicate: true, ideaId: duplicate.id, message: `That idea already exists as ${duplicate.id}. Use !vote ${duplicate.id} to support it.` };
  if (elapsed < state.settings.requestCooldownSeconds)
    return { ok: false, message: `Please wait ${Math.ceil(state.settings.requestCooldownSeconds - elapsed)} seconds before sending another feature request.` };
  const title = text.length <= 100 ? text : `${text.slice(0, 97).trimEnd()}…`;
  const idea = createIdea(state, { title, description: text, username: input.username, ...(input.userId ? { userId: input.userId } : {}), source: input.source ?? 'simulator' });
  state.ingestMeta.lastRequests[userId] = now;
  return { ok: true, ideaId: idea.id, message: `Added ${idea.id}. The community can now !vote ${idea.id}.` };
}

function status(state: InternalState, ideaId: string): ChatResult {
  const idea = state.ideas.find(i => i.id === ideaId);
  if (!idea) return { ok: false, message: `Idea ${ideaId} does not exist.` };
  const label = idea.status === 'shipped' ? 'accepted' : idea.status;
  return { ok: true, ideaId: idea.id, message: `${idea.id} · ${idea.title} · ${label} · ${idea.voters.length} votes${idea.plan ? ' · plan saved' : ''}${idea.lastError ? ' · run needs streamer attention' : ''}.` };
}

function me(state: InternalState, userId: string, username: string): string {
  const profile = buildCommunity(state).find(p => p.contributor.id === userId);
  if (!profile) return `${username}: no contributions yet.`;
  const badges = profile.earnedBadges.length ? ` (${profile.earnedBadges.map(b => b.title).join(', ')})` : '';
  return `${username}: ${profile.ideas} screened ideas · ${profile.votesReceived} votes received · ${profile.votesCast} other ideas backed · ${profile.implementations} accepted implementations · ${profile.earnedBadges.length} badges${badges}.`;
}

/** Applies one chat message: commands, contributor identity, unique votes, cooldowns and event deduplication. */
export async function ingestChat(store: StudioStore, raw: ChatInput): Promise<ChatResult> {
  const source = raw.source ?? 'simulator';
  if (raw.text.length > 8000) throw new StudioError('Messages must contain 1–2,000 characters.');
  // Normalize before anything else: commands, duplicate checks, heuristics, notes and model input all see the same clean text.
  const { text, removed } = sanitizeText(raw.text);
  const username = cleanLine(raw.username);
  if (!text || text.length > 2000) throw new StudioError('Messages must contain 1–2,000 characters.');
  if (!username || username.length > 50) throw new StudioError('A username of 1–50 characters is required.');
  const input: ChatInput = {
    ...raw, text, username,
    ...(raw.userId === undefined ? {} : { userId: cleanLine(raw.userId, 100) }), ...(raw.messageId === undefined ? {} : { messageId: cleanLine(raw.messageId, 200) }),
  };
  return store.transaction(state => {
    const messageKey = input.messageId ? `${source}:${input.messageId}` : undefined;
    const seen = messageKey ? state.ingestMeta.processedMessages.find(m => m.id === messageKey) : undefined;
    if (seen) return { ok: true, duplicate: true, ...(seen.ideaId ? { ideaId: seen.ideaId } : {}), message: 'This chat event was already processed.' };
    const userId = ensureContributor(state, { ...input, source });
    const parsed = parseCommand(text);
    const now = new Date().toISOString();
    const chat: ChatMessage = { id: crypto.randomUUID(), userId, username: input.username.trim(), text, createdAt: now, kind: 'message', source };
    let result: ChatResult = { ok: true, message: 'Message received.' };
    if (parsed.type === 'request') { result = request(state, { ...input, source }, userId, parsed.text, now); chat.kind = result.ok ? 'request' : 'error'; }
    else if (parsed.type === 'vote') { result = addVote(state, parsed.ideaId, { ...input, source }); chat.kind = result.ok ? 'vote' : 'error'; }
    else if (parsed.type === 'invalid') { result = { ok: false, message: parsed.message }; chat.kind = 'error'; }
    else if (parsed.type === 'help') result.message = HELP_TEXT;
    else if (parsed.type === 'status') result = status(state, parsed.ideaId);
    else if (parsed.type === 'me') result.message = me(state, userId, input.username);
    if (removed && parsed.type !== 'message') result.message += ' Hidden or invisible characters were removed from the message.';
    if (result.ideaId) chat.ideaId = result.ideaId;
    state.chat.push(chat);
    if (parsed.type !== 'message') state.chat.push({
      id: crypto.randomUUID(), userId: 'system:coforge', username: 'CoForge', text: result.message, kind: result.ok ? 'system' : 'error',
      createdAt: now, source, ...(result.ideaId ? { ideaId: result.ideaId } : {}),
    });
    if (messageKey) state.ingestMeta.processedMessages.push({ id: messageKey, ...(result.ideaId ? { ideaId: result.ideaId } : {}) });
    return result;
  });
}

const DEMO_REQUESTS = [
  'A little bridge over the creek', 'A quiet mode with fewer visual effects', 'Collect fallen leaves for camp decorations',
  'Let us watch the stars from our tent', 'A friendly frog near the pond', 'Remember the last selected tool',
  'A soft chime when the sun rises', 'Add a colorblind-friendly gathering highlight',
];
const DEMO_VIEWERS = ['luna_loop', 'pixelpirate', 'fernfriend', 'bytebloom', 'cozycoder', 'mothmode'];

/** A simulated viewer message: a vote, a new request or small talk. */
export async function simulateMessage(store: StudioStore, random: () => number = Math.random): Promise<ChatResult> {
  const state = store.snapshot();
  const people = state.contributors.filter(c => c.id.startsWith('simulator:')).slice(0, 12);
  const user = people.length ? people[Math.floor(random() * people.length)]! : { id: '', name: DEMO_VIEWERS[Math.floor(random() * DEMO_VIEWERS.length)]! };
  const available = state.ideas.filter(i => !['flagged', 'rejected'].includes(i.status) && !i.voters.includes(user.id));
  const unseen = DEMO_REQUESTS.find(title => !state.ideas.some(i => i.title === title));
  const text = available.length && (!unseen || random() > 0.35) ? `!vote ${available[Math.floor(random() * available.length)]!.id}`
    : unseen ? `!request ${unseen}` : 'This is becoming our favorite little game.';
  return ingestChat(store, { username: user.name, text, source: 'simulator', messageId: crypto.randomUUID(), ...(user.id ? { userId: user.id.replace(/^simulator:/, '') } : {}) });
}
