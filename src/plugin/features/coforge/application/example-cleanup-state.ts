import type { InternalState } from './ports';
import { recordOperation } from './population';
import { exampleRemovalCutoffsCheck } from '../domain/example-content';

/** Remove only selected request relationships; retained request authors, context and votes remain intact. */
export function removeExampleState(state: InternalState, selectedIds: readonly string[]) {
  const beforeChat = state.chat.length;
  const beforeEvents = state.events.length;
  const selected = new Set(selectedIds);
  if (selected.size) {
    const cutoffs = { ...state.exampleRemovalCutoffs };
    const now = new Date().toISOString();
    for (const id of selected) if (!cutoffs[id] || Date.parse(cutoffs[id]) < Date.parse(now)) cutoffs[id] = now;
    state.exampleRemovalCutoffs = exampleRemovalCutoffsCheck(cutoffs);
  }
  const jobs = new Set(state.jobs.filter(job => selected.has(job.ideaId)).map(job => job.id));
  const samples = new Set(state.sampleEventIds ?? []);
  state.ideas = state.ideas.filter(idea => !selected.has(idea.id));
  state.jobs = state.jobs.filter(job => !selected.has(job.ideaId));
  state.events = state.events.filter(event => !samples.has(event.id) && (!event.ideaId || !selected.has(event.ideaId)));
  state.chat = state.chat.filter(message => message.source !== 'simulator');
  state.requestOrigins = Object.fromEntries(Object.entries(state.requestOrigins ?? {}).filter(([id]) => !selected.has(id)));
  state.manualHolds = state.manualHolds.filter(id => !selected.has(id));
  state.sampleEventIds = [];

  const removedRewards = state.population.rewards.filter(reward => Boolean(reward.ideaId && selected.has(reward.ideaId)));
  state.population.rewards = state.population.rewards.filter(reward => !reward.ideaId || !selected.has(reward.ideaId));
  for (const player of state.population.players) {
    for (const reward of removedRewards.filter(reward => reward.playerId === player.id)) {
      player.coins = Math.max(0, player.coins - reward.coins);
      player.xp = Math.max(0, player.xp - reward.xp);
      player.reputation = Math.max(0, player.reputation - reward.reputation);
    }
    player.rewardClaims = player.rewardClaims.filter(claim => ![...selected].some(id => claim === `screened:${id}` || claim === `accepted:${id}`));
  }
  const referenced = new Set(state.ideas.flatMap(idea => [idea.authorId, ...idea.voters, ...(idea.contexts ?? []).map(context => context.authorId)]));
  for (const message of state.chat) referenced.add(message.userId);
  for (const reward of state.population.rewards) referenced.add(reward.playerId);
  for (const reply of state.botReplies) if (reply.greetingPlayerId) referenced.add(reply.greetingPlayerId);
  for (const player of state.population.players) if (player.moderationPending || player.restriction) referenced.add(player.id);
  for (const record of state.population.operations) if (record.effect === 'uncertain' && record.playerId) referenced.add(record.playerId);
  const removedProfiles = new Set([
    ...state.contributors.map(person => person.id), ...state.population.players.map(person => person.id),
  ].filter(id => id.startsWith('simulator:') && !referenced.has(id)));
  state.contributors = state.contributors.filter(person => !removedProfiles.has(person.id));
  state.population.players = state.population.players.filter(player => !removedProfiles.has(player.id));
  state.population.operations = state.population.operations.filter(record => !(record.playerId && removedProfiles.has(record.playerId)) && !(record.entityId && (selected.has(record.entityId) || jobs.has(record.entityId))));
  const changed = selected.size > 0 || removedProfiles.size > 0 || state.chat.length !== beforeChat || state.events.length !== beforeEvents;
  if (changed) recordOperation(state, 'example-content-removed', 'committed', undefined, selected.size);
  // Deduplication tombstones and monotonic IDs deliberately survive cleanup: removed intake must not replay.
  return { requests: selected.size, profiles: removedProfiles.size, changed };
}
