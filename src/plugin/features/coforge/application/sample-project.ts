import { StudioError } from '../domain/errors';
import { ideaProjectId, projectIdeas, initialProject, projectIdFor } from '../domain/projects';
import { createSeed } from '../domain/seed';
import { ideaIdFor } from '../domain/types';
import { isActiveJob } from '../domain/workflow';
import type { InternalState } from './ports';

/** Replaces only the selected project. Shared chat, contributors and other projects are retained. */
export function loadProjectSample(state: InternalState): void {
  if (!state.projects.length) {
    const sample = initialProject(createSeed().settings, state.integration, new Date().toISOString());
    sample.id = projectIdFor(state.nextProjectNumber++); state.projects.push(sample); state.activeProjectId = sample.id;
  }
  const projectId = state.activeProjectId;
  if (state.jobs.some(job => job.projectId === projectId && isActiveJob(job))) throw new StudioError('Cancel or finish this project’s active and queued jobs before resetting.', 409);
  const oldIds = new Set(projectIdeas(state).map(idea => idea.id));
  const sample = createSeed();
  const remap = new Map<string, string>();
  const ideas = sample.ideas.map(idea => {
    const number = state.projects.length === 1 ? idea.number : state.nextIdeaNumber++;
    const id = ideaIdFor(number);
    remap.set(idea.id, id);
    return { ...idea, id, number, projectId };
  });
  state.ideas = [...state.ideas.filter(idea => ideaProjectId(idea) !== projectId), ...ideas];
  state.nextIdeaNumber = Math.max(state.nextIdeaNumber, ...ideas.map(idea => idea.number + 1));
  const known = new Set(state.contributors.map(person => person.id));
  state.contributors.push(...sample.contributors.filter(person => !known.has(person.id)));
  state.jobs = state.jobs.filter(job => job.projectId !== projectId);
  state.events = state.events.filter(event => !event.ideaId || !oldIds.has(event.ideaId));
  state.events.push(...sample.events.map(event => ({ ...event, id: crypto.randomUUID(), ...(event.ideaId ? { ideaId: remap.get(event.ideaId) ?? event.ideaId } : {}) })));
  state.chat.push(...sample.chat.map(message => ({ ...message, id: crypto.randomUUID(),
    text: message.text.replace(/CFP-\d+/g, projectId).replace(/CF-\d+/g, id => remap.get(id) ?? id), ...(message.ideaId ? { ideaId: remap.get(message.ideaId) ?? message.ideaId } : {}) })));
  state.settings = sample.settings;
  state.manualHolds = state.manualHolds.filter(id => !oldIds.has(id));
}
