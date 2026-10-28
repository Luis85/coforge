import { contextEventId } from '../domain/integrity';
import { createSeed } from '../domain/seed';
import { isActiveJob } from '../domain/workflow';
import { ideaProjectId } from '../domain/projects';
import type { InternalState } from './ports';
import type { Idea } from '../domain/types';
import { removeExampleState } from './example-cleanup-state';

export interface CleanupRequest { id: string; title: string; projectId: string }
export interface ExampleCleanupPreview {
  stateKey: string;
  automatic: CleanupRequest[];
  legacy: CleanupRequest[];
  ambiguous: CleanupRequest[];
  preservedCount: number;
  localChatCount: number;
  localProfileCount: number;
  economyUsageCount: number;
  economyPerkCount: number;
  hasPersistentChanges: boolean;
  blocked: string;
  notes: Record<string, string>;
}
const seed = createSeed(0).ideas;
const item = (idea: Idea): CleanupRequest => ({ id: idea.id, title: idea.title, projectId: ideaProjectId(idea) });

/** Full original authored content can suggest a legacy sample, but never silently selects one. */
function legacySample(idea: Idea): boolean {
  return seed.some(sample => sample.title === idea.title && sample.description === idea.description && sample.category === idea.category && sample.authorId === idea.authorId);
}

export function exampleCleanupProblem(state: InternalState): string {
  if (!state.settings.paused || state.projects.some(project => !project.settings.paused))
    return 'Pause request automation in every project before removing example content.';
  if (state.jobs.some(isActiveJob) || state.runtime.herdrWorkflow?.busy)
    return 'Finish or cancel active and queued work, then inspect any external agent before cleanup.';
  if (state.ideas.some(idea => idea.workflowRun && !['finished', 'stopped', 'awaiting-review'].includes(idea.workflowRun.state)))
    return 'Finish or explicitly stop pending workflows before removing example content.';
  return '';
}

/** The preview excludes runtime readings and binds every editable request and local-history fact. */
export function exampleCleanupPlan(state: InternalState): ExampleCleanupPreview {
  const automatic: CleanupRequest[] = [];
  const legacy: CleanupRequest[] = [];
  const ambiguous: CleanupRequest[] = [];
  let preservedCount = 0;
  for (const idea of state.ideas) {
    const origin = state.requestOrigins?.[idea.id];
    if (origin === 'sample' || origin === 'local-test') automatic.push(item(idea));
    else if (origin) preservedCount++;
    else if (legacySample(idea)) legacy.push(item(idea));
    else ambiguous.push(item(idea));
  }
  const localChat = state.chat.filter(message => message.source === 'simulator');
  const cleanup = removeExampleState(structuredClone(state), automatic.map(idea => idea.id));
  return {
    stateKey: contextEventId(JSON.stringify([state.ideas, state.requestOrigins, state.projects, state.settings.paused, state.jobs,
      localChat, state.contributors, state.population.players, state.population.rewards, state.sampleEventIds, state.exampleRemovalCutoffs, state.population.economy])),
    automatic, legacy, ambiguous, preservedCount, localChatCount: localChat.length,
    localProfileCount: cleanup.profiles, economyUsageCount: cleanup.economyUsages, economyPerkCount: cleanup.economyPerks, hasPersistentChanges: cleanup.changed,
    blocked: exampleCleanupProblem(state), notes: {},
  };
}

/** Selection is restricted to the exact historical candidates the user reviewed. */
export function cleanupRequestIds(preview: ExampleCleanupPreview, additionalIds: readonly string[]): string[] {
  const candidates = new Set([...preview.legacy, ...preview.ambiguous].map(idea => idea.id));
  if (additionalIds.some(id => !candidates.has(id))) throw new Error('A selected request is outside this cleanup preview. Refresh the preview.');
  return [...new Set([...preview.automatic.map(idea => idea.id), ...additionalIds])];
}
