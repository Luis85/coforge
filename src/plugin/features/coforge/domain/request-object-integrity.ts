import type { Idea } from "./types";
import { contextEventId } from "./integrity-hash";
import { requestObjectIdentity } from "./request-object";

/** Human input only: integrity quarantine may legitimately change derived status before writing. */
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, ordered(entry)]),
    );
  return value;
}
export const requestObjectEditIdentity = (
  idea: Pick<
    Idea,
    | "id"
    | "projectId"
    | "authorId"
    | "title"
    | "description"
    | "category"
    | "requestKind"
    | "contexts"
    | "reviewNote"
    | "requestObject"
    | "workflowRun"
    | "workflowHistory"
  >,
): string =>
  contextEventId(
    JSON.stringify(
      ordered([
        idea.id,
        idea.projectId ?? "",
        idea.authorId,
        idea.title,
        idea.description,
        idea.category,
        idea.requestKind ?? "feature",
        idea.contexts ?? [],
        idea.reviewNote ?? null,
        ...(idea.requestObject
          ? [requestObjectIdentity(idea.requestObject)]
          : []),
        idea.workflowRun ?? null,
        idea.workflowHistory ?? [],
      ]),
    ),
  );
