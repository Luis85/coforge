import { contextEventId } from "../domain/integrity";
import type { CouncilPreflight } from "./council-execution";
import type { WorkflowV2Preview } from "./workflow-v2-ports";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
function source(preview: Pick<CouncilPreflight, "source">) {
  return {
    revision: preview.source.revision,
    generation: preview.source.generation,
    markdown: preview.source.markdown,
    ...(preview.source.linkedIdea ? { linkedIdea: preview.source.linkedIdea } : {}),
  };
}
/** A freshness fingerprint, never a capability grant. Assigning minimal note identity does not change reviewed content. */
export function reviewedCouncilIdentity(preview: CouncilPreflight): string {
  return contextEventId(
    JSON.stringify(
      canonical({
        format: "council-reviewed/v1",
        source: source(preview),
        context: preview.context,
        projectPrompt: preview.projectPrompt ?? "",
        executionLimits: preview.executionLimits,
        plan: preview.plan,
      }),
    ),
  );
}
export function reviewedWorkflowIdentity(preview: WorkflowV2Preview): string {
  const subject = preview.plan.subject;
  const captured = {
    kind: subject.kind,
    revision: subject.revision,
    markdown: subject.markdown,
    ...(subject.kind === "idea" ? { ideaId: subject.ideaId } : {}),
  };
  return contextEventId(
    JSON.stringify(
      canonical({
        format: "workflow-reviewed/v1",
        source: source(preview),
        context: preview.context,
        projectPrompt: preview.projectPrompt ?? "",
        plan: { ...preview.plan, subject: captured },
      }),
    ),
  );
}
const STALE =
  "The source, context or selected definitions changed after preflight. Run preflight again before submitting.";
export function assertReviewedCouncilIdentity(
  preview: CouncilPreflight,
  expectedIdentity?: string,
): void {
  if (
    expectedIdentity !== undefined &&
    reviewedCouncilIdentity(preview) !== expectedIdentity
  )
    throw new Error(STALE);
}
export function assertReviewedWorkflowIdentity(
  preview: WorkflowV2Preview,
  expectedIdentity?: string,
): void {
  if (
    expectedIdentity !== undefined &&
    reviewedWorkflowIdentity(preview) !== expectedIdentity
  )
    throw new Error(STALE);
}
