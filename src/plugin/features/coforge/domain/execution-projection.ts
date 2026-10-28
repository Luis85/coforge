import type { ExecutionArtifact, ExecutionRun } from "./execution-run";
import { markdownForNote } from "./markdown-note";

/** V2 projections cannot be mistaken for legacy workflow progress. Text is never runtime authority. */
export function executionContributionBlock(
  run: ExecutionRun,
  artifact: ExecutionArtifact,
): string {
  const safe = markdownForNote(artifact.markdown);
  return (
    `<!-- coforge:v2:${artifact.id}:begin -->\n### ${artifact.roundId} — ${artifact.agentId}${artifact.skipped ? " (missing contribution)" : ""}${artifact.simulated ? " (simulation)" : ""}\n\n` +
    `Session: ${run.id} · Attempt: ${artifact.attemptId} · Agent revision: ${artifact.agentRevision}\n` +
    `Provider/model: ${artifact.provider}/${artifact.model} · Source revision: ${run.subject.revision}\n` +
    `Inputs: ${artifact.inputArtifactIds.join(", ") || "captured source"} · ${artifact.createdAt}\n\n${safe}\n<!-- coforge:v2:${artifact.id}:end -->`
  );
}
export function projectExecutionContribution(
  source: string,
  run: ExecutionRun,
  artifact: ExecutionArtifact,
): string {
  const block = executionContributionBlock(run, artifact);
  const start = `<!-- coforge:v2:${artifact.id}:begin -->`;
  const end = `<!-- coforge:v2:${artifact.id}:end -->`;
  const first = source.indexOf(start);
  if (first >= 0) {
    const last = source.indexOf(end, first);
    if (
      last < 0 ||
      source.indexOf(start, first + start.length) >= 0 ||
      source.slice(first, last + end.length) !== block
    )
      throw new Error(
        "Publication conflict: the generated contribution was edited. Retain both versions and inspect the saved result.",
      );
    return source;
  }
  if (source.includes(end))
    throw new Error(
      "Publication conflict: an incomplete contribution block needs inspection.",
    );
  return `${source}${source.endsWith("\n") ? "\n" : "\n\n"}${block}\n`;
}
