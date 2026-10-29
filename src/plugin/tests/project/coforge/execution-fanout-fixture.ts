import {
  ExecutionKernel,
  type ExecutionKernelHost,
} from "../../../features/coforge/application/execution-kernel";
import {
  emptyExecutionJournal,
  type ExecutionAdmission,
  type ExecutionResponse,
} from "../../../features/coforge/domain/execution-run";

export function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function fanoutFixture() {
  let journal = emptyExecutionJournal();
  let ids = 0;
  let clock = 0;
  const entered: string[] = [];
  const published: string[] = [];
  const waits = new Map(
    ["a", "b", "c"].map((id) => [id, deferred<ExecutionResponse>()]),
  );
  const host: ExecutionKernelHost = {
    journal: {
      load: async () => structuredClone(journal),
      save: async (next) => {
        journal = structuredClone(next);
      },
    },
    now: () => "2026-10-28T12:00:00Z",
    id: () => `attempt-${++ids}`,
    monotonicMs: () => clock,
    assertEligible: async () => {},
    resolveInvocation: (run, invocation) => ({
      prompt: JSON.stringify([run.subject.markdown, invocation.inputRoundIds]),
      inputArtifactIds: run.artifacts
        .filter((a) => invocation.inputRoundIds.includes(a.roundId))
        .map((a) => a.id),
    }),
    invoke: async (_run, invocation) => {
      entered.push(invocation.id);
      return waits.get(invocation.id)!.promise;
    },
    publish: async (_run, artifact) => {
      published.push(artifact.invocationId);
    },
  };
  const admission: ExecutionAdmission = {
    id: "run",
    submissionKey: "submission",
    projectId: "project",
    teamId: "team",
    context: "Captured",
    subject: {
      kind: "note",
      sourceId: "source",
      revision: "rev-1",
      markdown: "Original question",
    },
    limits: {
      timeoutSeconds: 30,
      maxTurns: 2,
      maxBudgetUsd: 1,
      simulation: false,
      maxInvocations: 10,
      executionLimitMs: 15000,
    },
    invocations: ["a", "b", "c"].map((id) => ({
      id,
      roundId: id === "c" ? "solutions" : "opinions",
      agentId: id,
      agentRevision: "r1",
      provider: "claude",
      model: "sonnet",
      instructions: "Analyze independently",
      access: "none",
      inputRoundIds: id === "c" ? ["opinions"] : [],
      ...(id !== "c" ? { promptOrder: "fan-out" as const } : {}),
    })),
  };
  return {
    host,
    admission,
    kernel: new ExecutionKernel(host),
    entered,
    published,
    waits,
    advance: (ms: number) => {
      clock += ms;
    },
    get journal() {
      return journal;
    },
  };
}
export const answer = (markdown: string): ExecutionResponse => ({
  markdown,
  simulated: false,
  costUsd: 0.1,
});
