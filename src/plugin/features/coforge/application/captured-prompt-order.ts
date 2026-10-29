import type { ExecutionInvocation } from "../domain/execution-run";

/** An edited journal cannot turn a captured sequential round into a concurrent batch. */
export function assertCapturedPromptOrder(
  retained: readonly ExecutionInvocation[] | undefined,
  compiled: readonly { id: string; promptOrder?: "round-robin" | "fan-out" }[],
): void {
  if (!retained) return;
  const expected = new Map(
    compiled.map((item) => [item.id, item.promptOrder ?? "round-robin"]),
  );
  if (
    retained.some(
      (item) =>
        (item.promptOrder ?? "round-robin") !==
        (expected.get(item.id) ?? "round-robin"),
    )
  )
    throw new Error(
      "The captured invocation prompt order differs from its pinned definition. Inspect the retained run before recovery.",
    );
}
