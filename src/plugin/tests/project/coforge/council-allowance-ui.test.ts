import { expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { computed, reactive } from "vue";
import { councilHistoryActions } from "../../../presentation/composables/coforge/council-history-actions";
import { useCouncilStore } from "../../../presentation/stores/coforge-council";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";

it("renders effective allowance for a reactive v2 workflow with scoped limits without cloning Vue proxies", () => {
  setActivePinia(createPinia());
  const now = "2026-10-28T12:00:00.000Z";
  const run: ExecutionRun = {
    id: "run",
    submissionKey: "submission",
    subject: {
      kind: "note",
      sourceId: "source",
      revision: "one",
      markdown: "Proposal",
    },
    projectId: "project",
    teamId: "team",
    context: "",
    invocations: [
      {
        id: "step",
        roundId: "opinion",
        agentId: "agent",
        agentRevision: "one",
        provider: "demo",
        model: "sonnet",
        instructions: "Review the source.",
        access: "none",
        inputRoundIds: [],
        executionScope: { id: "council-step", limitMs: 60000 },
      },
    ],
    limits: {
      timeoutSeconds: 30,
      maxTurns: 4,
      maxBudgetUsd: 1,
      maxInvocations: 2,
      executionLimitMs: 120000,
      simulation: true,
    },
    cursor: 0,
    state: "queued",
    attempts: [],
    artifacts: [],
    createdAt: now,
    updatedAt: now,
  };
  const actions = councilHistoryActions({
    store: useCouncilStore(),
    ideas: computed(() => []),
    run: async (work) => {
      await work();
    },
    service: () => {
      throw new Error("No mutation requested.");
    },
  });
  expect(actions.allowanceLimits(reactive(run))).toEqual({
    maxInvocations: 2,
    executionLimitMs: 120000,
    scopeLimits: [{ id: "council-step", limitMs: 60000 }],
  });
});
