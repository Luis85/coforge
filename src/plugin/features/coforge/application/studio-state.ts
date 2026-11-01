import { ideaFingerprint, needsVerification, quarantine } from "../domain/integrity";
import { omit } from "../domain/objects";
import type { PersistedStudio } from "../domain/persisted";
import { createEmptyState, defaultIntegration, defaultRuntime, defaultSettings } from "../domain/seed";
import { copySettings, initialProject, INITIAL_PROJECT_ID, projectPaths } from "../domain/projects";
import type { Activity, Idea } from "../domain/types";
import type { InternalState, LoadedStudio, NoteIdea } from "./ports";
import { emptyPopulation } from "../domain/population";
import { stopUntrustedWorkflow, workflowIntegrityKey, workflowMetadataFingerprint, polishingIntegrityKey, polishingMetadataFingerprint } from './workflow-note-integrity';

export function addEvent(state: InternalState, type: Activity["type"], text: string, ideaId?: string): void {
  state.events.push({
    id: crypto.randomUUID(),
    type,
    text,
    ...(ideaId ? { ideaId } : {}),
    createdAt: new Date().toISOString(),
  });
}

/** Joins idea notes with the votes and increments kept in plugin data. */
export function assemble(loaded: LoadedStudio): InternalState {
  const data: PersistedStudio = loaded.data ?? {
    ...createEmptyState(),
    integration: defaultIntegration(),
    votes: {},
    increments: {},
    ingestMeta: { processedMessages: [], lastRequests: {} },
    manualHolds: [],
    integrity: {},
  };
  const projects = [...(loaded.projects ?? [])];
  const legacy = data.activeProjectId === undefined && data.nextProjectNumber === undefined;
  if (
    legacy &&
    (loaded.data || loaded.notes.some((note) => !note.projectId)) &&
    !projects.some((project) => project.id === INITIAL_PROJECT_ID)
  )
    projects.unshift(initialProject(data.settings, data.integration, new Date().toISOString()));
  const integrity = { ...data.integrity };
  const ids = new Set<string>();
  const ideas: Idea[] = loaded.notes
    .map((note) => {
      if (ids.has(note.id)) throw new Error(`Two notes use the idea ID ${note.id}. Rename or remove one of them.`);
      ids.add(note.id);
      const archived = [...(data.deletedRequests ?? [])].reverse().find(item => item.id === note.id && item.createdAt === note.createdAt && item.projectId === (note.projectId ?? INITIAL_PROJECT_ID));
      const increment = data.increments[note.id] ?? (archived?.increment ? structuredClone(archived.increment) : undefined);
      const idea = {
        ...note,
        projectId: note.projectId ?? INITIAL_PROJECT_ID,
        voters: [...new Set(data.votes[note.id] ?? archived?.voters ?? [])],
        ...(increment ? { increment } : {}),
      };
      if (!note.projectId && integrity[note.id] === ideaFingerprint(note)) integrity[note.id] = ideaFingerprint(idea);
      return idea;
    })
    .sort((a, b) => a.number - b.number);
  const nextIdeaNumber = Math.max(data.nextIdeaNumber, ...ideas.map((idea) => idea.number + 1));
  const rest = omit(data, "votes", "increments");
  const activeProjectId = data.activeProjectId || projects[0]?.id || "";
  for (const id of new Set(
    [activeProjectId, ...ideas.map((idea) => idea.projectId ?? INITIAL_PROJECT_ID)].filter(Boolean),
  )) {
    if (!projects.some((project) => project.id === id))
      projects.push({
        ...initialProject(
          { ...data.settings, projectName: `Missing project note (${id})`, paused: true },
          defaultIntegration(),
          new Date().toISOString(),
        ),
        id,
        unavailable: true,
      });
  }
  const selected = projects.find((project) => project.id === activeProjectId);
  const nextProjectNumber = Math.max(
    data.nextProjectNumber ?? 1,
    ...projects.map((project) => Number(project.id.match(/^CFP-(\d+)$/)?.[1] ?? 0) + 1),
  );
  for (const job of rest.jobs)
    job.projectId ??= ideas.find((idea) => idea.id === job.ideaId)?.projectId ?? INITIAL_PROJECT_ID;
  const botReplies = (data.botReplies ?? []).map((reply) =>
    reply.status === "sending"
      ? {
          ...reply,
          status: "uncertain" as const,
          error:
            "The previous session ended before delivery was confirmed. This reply will not be resent automatically.",
        }
      : reply,
  );
  if (rest.twitchOperations) rest.twitchOperations.intents = rest.twitchOperations.intents.map(intent => intent.status === 'sending' ? { ...intent, status: 'uncertain' as const, error: 'The previous session ended before Twitch confirmed the action. Inspect Twitch; this action will not be replayed.' } : intent);
  const streamMessages = (data.streamMessages ?? []).map((message) => {
    const next = { ...message };
    delete next.nextDueAt;
    delete next.streamKey;
    const unconfirmed = botReplies.find(
      (reply) => reply.streamMessageId === message.id && reply.status === "uncertain" && !reply.reviewedAt,
    );
    if (unconfirmed) {
      next.active = false;
      next.lastError = "A previous send was unconfirmed. Check Twitch before reactivating this message.";
    }
    return next;
  });
  for (const reply of botReplies) if (reply.streamMessageId && reply.status === "pending") reply.status = "cancelled";
  return {
    ...rest,
    ...(data.requestOrigins ? { requestOrigins: Object.fromEntries(Object.entries(data.requestOrigins).filter(([id]) => ids.has(id))) } : {}),
    streamMessages,
    population: data.population ?? emptyPopulation(),
    botReplies,
    integrity,
    nextIdeaNumber,
    nextProjectNumber,
    ideas,
    projects,
    activeProjectId,
    settings: copySettings(selected?.settings ?? data.settings),
    integration: { ...data.integration, ...(selected ? projectPaths(selected) : {}) },
    runtime: defaultRuntime(),
  };
}

/** Applies an edit made directly to an idea note, keeping plugin-owned votes and increments. */
/**
 * Verifies ideas that came from the vault against the fingerprints of what CoForge last wrote, quarantines any
 * changed or unknown idea past the inbox, then records fresh fingerprints for every idea. Returns quarantined IDs.
 */
export function enforceIntegrity(state: InternalState, external: ReadonlySet<string> | "all"): string[] {
  const quarantined: string[] = [];
  for (const idea of state.ideas) {
    if (external !== "all" && !external.has(idea.id)) continue;
    const workflowKey = workflowIntegrityKey(idea);
    const polishKey = polishingIntegrityKey(idea);
    if ((idea.polishingRuns?.length || idea.polishingAmendments?.length || state.integrity[polishKey]) && state.integrity[polishKey] !== polishingMetadataFingerprint(idea)) {
      stopUntrustedWorkflow(idea); quarantined.push(idea.id);
      addEvent(state, 'system', `${idea.id} has externally changed polishing progress. Inspect its retained results before continuing.`, idea.id);
    }
    if ((idea.workflowRun || idea.workflowHistory?.length || state.integrity[workflowKey]) && state.integrity[workflowKey] !== workflowMetadataFingerprint(idea)) {
      stopUntrustedWorkflow(idea);
      quarantined.push(idea.id);
      addEvent(state, 'system', `${idea.id} has externally changed workflow progress. Inspect it and start a fresh workflow.`, idea.id);
    }
    if (!needsVerification(idea) || state.integrity[idea.id] === ideaFingerprint(idea)) continue;
    quarantine(idea);
    quarantined.push(idea.id);
    addEvent(
      state,
      "system",
      `${idea.id} was changed or added outside CoForge after screening. It is back in the inbox for a new screening.`,
      idea.id,
    );
  }
  const previousIntegrity = state.integrity;
  state.integrity = Object.fromEntries(state.ideas.flatMap(idea => {
    const key = workflowIntegrityKey(idea);
    // Removing managed note fields must not turn configured code into unguarded legacy work.
    const fingerprint = idea.workflowRun || idea.workflowHistory?.length ? workflowMetadataFingerprint(idea) : previousIntegrity[key];
    const polishKey = polishingIntegrityKey(idea); const polishFingerprint = idea.polishingRuns?.length || idea.polishingAmendments?.length ? polishingMetadataFingerprint(idea) : previousIntegrity[polishKey];
    return [[idea.id, ideaFingerprint(idea)], ...(fingerprint !== undefined ? [[key, fingerprint]] : []), ...(polishFingerprint !== undefined ? [[polishKey, polishFingerprint]] : [])];
  }));
  return quarantined;
}

export function mergeNote(state: InternalState, note: NoteIdea): boolean {
  note = { ...note, projectId: note.projectId ?? INITIAL_PROJECT_ID };
  if (!state.projects.some((project) => project.id === note.projectId)) {
    state.projects.push({
      ...initialProject(
        { ...defaultSettings(), projectName: `Missing project note (${note.projectId})` },
        defaultIntegration(),
        new Date().toISOString(),
      ),
      id: note.projectId!,
      unavailable: true,
    });
    state.nextProjectNumber = Math.max(state.nextProjectNumber, Number(note.projectId!.slice(4)) + 1);
  }
  const index = state.ideas.findIndex((idea) => idea.id === note.id);
  const current = state.ideas[index];
  if (current) {
    const { voters, increment, ...known } = current;
    if (JSON.stringify(known) === JSON.stringify(note)) return false;
    state.ideas[index] = { ...note, voters, ...(increment ? { increment } : {}) };
  } else {
    state.ideas.push({ ...note, voters: [] });
    state.nextIdeaNumber = Math.max(state.nextIdeaNumber, note.number + 1);
  }
  return true;
}
