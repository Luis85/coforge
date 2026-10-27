import type { InternalState, SaveOptions } from "./ports";
import { synchronizeProject } from "../domain/projects";
import { enforceIntegrity } from "./studio-state";
import { settleContributionRewards } from "./economy";
import { trimPopulation } from "./population";

/** Pure aggregate policies run before persistence. Store orchestration knows only the resulting state/events. */
export function prepareStudioCommit(previous: InternalState, next: InternalState, options: SaveOptions) {
  synchronizeProject(next);
  const quarantined = enforceIntegrity(next, new Set(options.fromNotes ?? []));
  settleContributionRewards(previous, next, options.fromNotes);
  const events = next.population.operations.filter((record) => record.sequence >= previous.population.nextSequence);
  trimPopulation(next);
  next.events = next.events.slice(-500);
  next.chat = next.chat.slice(-250);
  next.jobs = next.jobs.slice(-500);
  const activeReplies = next.botReplies.filter((reply) => reply.status === "pending" || reply.status === "sending");
  next.botReplies = [
    ...next.botReplies.filter((reply) => reply.status !== "pending" && reply.status !== "sending").slice(-200),
    ...activeReplies,
  ];
  next.ingestMeta.processedMessages = next.ingestMeta.processedMessages.slice(-10000);
  return { events, fromNotes: options.fromNotes?.filter((id) => !quarantined.includes(id)) };
}
