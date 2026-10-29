import type {
  ExecutionJournalPort,
  ExecutionKernelHost,
} from "../../features/coforge/application/execution-kernel";
import {
  councilDispatch,
  decodeCouncilPlan,
} from "../../features/coforge/application/council-execution";
import {
  canSkipWorkflowV2Contribution,
  isWorkflowV2Run,
  workflowV2Dispatch,
} from "../../features/coforge/application/workflow-v2-execution";
import type { CouncilRunContext } from "./council-run-context";
import type { CouncilInvocationHost } from "./council-invocation-host";
import type { CouncilWorkflowMessaging } from "./council-workflow-messaging";
import type { CouncilMessagingModule } from "./council-messaging-module";
import type { CouncilSourceNotes } from "./council-source-notes";

interface CouncilKernelServices {
  context(): CouncilRunContext;
  invocations(): CouncilInvocationHost;
  workflowMessages(): CouncilWorkflowMessaging;
  messages(): CouncilMessagingModule;
  sources: CouncilSourceNotes;
  assertExecutor(): Promise<void>;
}
/** The execution kernel receives host capabilities, while editable definitions only supply task content. */
export function councilKernelHost(
  journal: ExecutionJournalPort,
  services: CouncilKernelServices,
): ExecutionKernelHost {
  return {
    journal,
    id: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    monotonicMs: () => performance.now(),
    assertEligible: (run, invocation) =>
      services.context().eligible(run, invocation),
    resolveInvocation: (run, invocation) =>
      isWorkflowV2Run(run)
        ? workflowV2Dispatch(run, invocation)
        : councilDispatch(run, invocation),
    invoke: (run, invocation, attempt, timing) =>
      services.invocations().invoke(run, invocation, attempt, timing),
    withInvocationBatch: (run, work) => services.invocations().batch(run.id, work),
    publish: async (run, artifact) => {
      await services.assertExecutor();
      services
        .context()
        .sourcePath(
          services.sources.resolve(
            run.projectionTarget?.sourceId ?? run.subject.sourceId,
          ),
        );
      await services.sources.project(run, artifact);
    },
    assertLocalEligible: async (run, action) => {
      await services.context().assertRun(run);
      await services.workflowMessages().prepare(run, action);
    },
    commitLocalAction: (next, run, action) =>
      services.workflowMessages().commit(next, run, action),
    validateProjectionTarget: async (_run, sourceId) => {
      await services.assertExecutor();
      const path = services
        .context()
        .sourcePath(services.sources.resolve(sourceId));
      if ((await services.sources.read(path)).sourceId !== sourceId)
        throw new Error("The destination identity changed.");
    },
    cancelInvocation: (id) => services.invocations().cancel(id),
    canSkip: (run, invocation) => {
      if (isWorkflowV2Run(run))
        return canSkipWorkflowV2Contribution(run, invocation);
      const round = decodeCouncilPlan(run).definition.rounds.find(
        (item) => item.id === invocation.roundId,
      );
      return (
        round?.completion.kind === "partial" &&
        round.participants.length -
          run.artifacts.filter(
            (item) => item.roundId === round.id && item.skipped,
          ).length -
          1 >=
          round.completion.minimum
      );
    },
    commitMessages: (next, _run, attempt, drafts) =>
      services.messages().commit(next, attempt, drafts),
  };
}
