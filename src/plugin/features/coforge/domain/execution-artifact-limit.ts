import type { ExecutionInvocation, ExecutionResponse } from "./execution-types";
export function assertExecutionArtifactLimit(
  invocation: Pick<ExecutionInvocation, "maxArtifactCharacters">,
  result: ExecutionResponse,
): void {
  if (
    result.markdown.length > (invocation.maxArtifactCharacters ?? 16000) ||
    (result.plan &&
      result.plan.markdown.length > (invocation.maxArtifactCharacters ?? 16000))
  )
    throw new Error(
      "The provider artifact exceeds its captured character allowance. No content was truncated or accepted.",
    );
}
