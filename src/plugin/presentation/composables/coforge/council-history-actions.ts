import { toRaw, type ComputedRef } from "vue";
import type { CouncilActions } from "../../../features/coforge/application/council-ports";
import type { Idea } from "../../../features/coforge/domain/types";
import { workflowProposalRevision } from "../../../features/coforge/domain/configured-workflow-run";
import type { useCouncilStore } from "../../stores/coforge-council";
import { effectiveExecutionAllowance } from "../../../features/coforge/domain/execution-allowance";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";

export function councilHistoryActions(host: {
  store: ReturnType<typeof useCouncilStore>;
  service(): Pick<
    CouncilActions,
    | "exportRun"
    | "pruneRun"
    | "reassignProjection"
    | "handoffPlan"
    | "extendAllowance"
  >;
  run(work: () => Promise<void>): Promise<void>;
  ideas: ComputedRef<Idea[]>;
}) {
  const { store } = host;
  return {
    allowanceLimits: (run: ExecutionRun) =>
      effectiveExecutionAllowance(toRaw(run)),
    extendAllowance: (id: string) =>
      host.run(async () => {
        const calls = Number(store.allowanceCalls);
        const milliseconds = Number(store.allowanceMinutes) * 60000;
        await host.service().extendAllowance(id, {
          ...(calls > 0 ? { additionalInvocations: calls } : {}),
          ...(milliseconds > 0 ? { additionalExecutionMs: milliseconds } : {}),
          ...(store.allowanceScope ? { scopeId: store.allowanceScope } : {}),
          reason: store.allowanceReason,
        });
        store.allowanceCalls = 0;
        store.allowanceMinutes = 0;
        store.allowanceScope = "";
        store.allowanceReason = "";
        store.notice =
          "Allowance extension recorded. Inspect uncertainty before explicitly retrying or resuming work.";
      }),
    exportRun: (id: string) =>
      host.run(async () => {
        const exported = await host.service().exportRun(id);
        if (store.inspectedRun !== id) return;
        store.exportedRun = exported;
        store.pruneConsent = false;
      }),
    pruneRun: (id: string) =>
      host.run(async () => {
        if (!store.pruneConsent || !store.exportedRun)
          throw new Error(
            "Export the run and explicitly confirm removal of its readable history.",
          );
        await host.service().pruneRun(id);
        if (store.inspectedRun === id) {
          store.inspectedRun = "";
          store.exportedRun = "";
          store.pruneConsent = false;
        }
        store.notice =
          "Settled history removed. Submission tombstones still prevent replay.";
      }),
    reassign: (id: string) =>
      host.run(async () => {
        await host.service().reassignProjection(id, store.reassignPath);
        store.notice =
          "Recorded results were projected to the explicitly chosen existing private note. The original input snapshot is unchanged.";
      }),
    handoffPlan: (id: string) =>
      host.run(async () => {
        const idea = host.ideas.value.find(
          (item) => item.id === store.handoffIdeaId,
        );
        if (!idea)
          throw new Error("Select an existing request in this project.");
        await host
          .service()
          .handoffPlan(
            id,
            store.handoffArtifactId,
            idea.id,
            workflowProposalRevision(idea),
          );
        store.notice =
          "The selected typed plan was handed to the existing project workflow. Its host permissions, configured steps and final code review remain in effect.";
      }),
  };
}
