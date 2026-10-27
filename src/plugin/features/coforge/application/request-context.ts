import type { InternalState } from "./ports";
import type { ChatResult } from "./chat";
import { meaningful } from "../domain/sanitize";
import { recordOperation } from "./population";
import { addEvent } from "./studio-state";
export function addRequestContext(
  state: InternalState,
  ideaId: string,
  text: string,
  authorId: string,
  authorName: string,
  now: string,
  eventId?: string,
): ChatResult {
  const idea = state.ideas.find((idea) => idea.id === ideaId);
  if (!idea) return { ok: false, message: `Request ${ideaId} does not exist.` };
  if (["shipped", "rejected"].includes(idea.status))
    return {
      ok: false,
      message: `${ideaId} is closed. Submit a new feature or bug for further work.`,
    };
  if (
    !state.projects.some(
      (project) => project.id === idea.projectId && !project.unavailable,
    )
  )
    return {
      ok: false,
      message: "This project is unavailable. Ask the streamer to restore it.",
    };
  if (!meaningful(text))
    return {
      ok: false,
      message: "Add useful context in words after the request ID.",
    };
  if (
    idea.contexts?.some(
      (context) =>
        context.id === eventId ||
        (context.authorId === authorId && context.text === text),
    )
  )
    return {
      ok: true,
      duplicate: true,
      ideaId,
      message: `That context is already recorded on ${ideaId}.`,
    };
  if ((idea.contexts?.length ?? 0) >= 100)
    return {
      ok: false,
      message:
        "This request has reached its context limit. Ask the streamer to consolidate it.",
    };
  idea.contexts = [
    ...(idea.contexts ?? []),
    {
      id: eventId ?? crypto.randomUUID(),
      authorId,
      authorName,
      text,
      createdAt: now,
    },
  ];
  idea.status = "inbox";
  idea.updatedAt = now;
  delete idea.screening;
  delete idea.rice;
  delete idea.plan;
  idea.lastError =
    "Viewer context was added. Screen the complete request again before further agent work.";
  recordOperation(
    state,
    "request-context-added",
    "committed",
    authorId,
    1,
    idea.id,
  );
  addEvent(
    state,
    "idea",
    `${authorName} added context to ${idea.id}; screening is required again.`,
    idea.id,
  );
  return {
    ok: true,
    ideaId,
    message: `Context added to ${ideaId}. It returned to screening; results for its previous revision will not apply.`,
  };
}
