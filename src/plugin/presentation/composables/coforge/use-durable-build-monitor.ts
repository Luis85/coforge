import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
import {
  DEFAULT_DURABLE_IDLE_WARNING_SECONDS,
  sameDurableBuildRef,
} from "../../../features/coforge/domain/durable-build";
import { buildDuration } from "./durable-build-display";
import { ideaWorkflowRun } from './idea-workflow-run';

const phaseLabels = {
  prepared: "Reserved — not started",
  starting: "Starting background Build",
  running: "Build running",
  finalizing: "Saving Build evidence",
  completed: "Worker finished",
  failed: "Build failed",
  cancelled: "Worker termination reported",
  attention: "Worker needs attention",
};
export function useDurableBuildMonitor(
  ideaId: () => string,
  runId: () => string | undefined,
  jobId: () => string | undefined = () => undefined,
) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const now = ref(Date.now());
  const checking = ref(false);
  const error = ref("");
  let timer: number | undefined;
  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = Date.now();
    }, 5000);
  });
  onBeforeUnmount(() => {
    if (timer !== undefined) window.clearInterval(timer);
  });
  const idea = computed(() =>
    store.state?.ideas.find((item) => item.id === ideaId()),
  );
  const run = computed(() => ideaWorkflowRun(idea.value, runId()));
  const job = computed(() => {
    const jobs = (store.state?.jobs ?? []).filter(
      (item) =>
        item.ideaId === ideaId() &&
        item.stage === "implement" &&
        (runId() ? item.workflow?.runId === runId() : !item.workflow),
    );
    const active = run.value?.activeAttemptId;
    if (jobId()) return jobs.find(job => job.id === jobId());
    return (
      (active
        ? jobs.find((item) => item.workflow?.attemptId === active)
        : undefined) ?? jobs.at(-1)
    );
  });
  const durable = computed(() => job.value?.durable);
  watch(
    () =>
      `${ideaId()}:${runId()}:${job.value?.id}:${durable.value?.ref.executionId}`,
    () => {
      error.value = "";
    },
  );
  const hot = computed(() => {
    const value =
      job.value && store.state?.runtime.durableBuildSnapshots?.[job.value.id];
    return value &&
      durable.value &&
      sameDurableBuildRef(durable.value.ref, value.ref)
      ? value
      : undefined;
  });
  const snapshot = computed(() => {
    const saved = durable.value?.snapshot;
    const matching =
      saved &&
      durable.value &&
      sameDurableBuildRef(durable.value.ref, saved.ref)
        ? saved
        : undefined;
    return hot.value && (!matching || hot.value.sequence >= matching.sequence)
      ? hot.value
      : matching;
  });
  const identityMismatch = computed(() =>
    Boolean(durable.value?.snapshot && !snapshot.value),
  );
  const policy = computed(
    () => durable.value?.policy ?? job.value?.workflow?.step.execution,
  );
  const legacy = computed(() => Boolean(job.value && !policy.value));
  const lifecycle = computed(() =>
    !legacy.value
      ? "background"
      : job.value?.provider === "mcp" || run.value?.external
        ? "mcp"
        : job.value?.provider === "herdr"
          ? "herdr"
          : job.value?.provider === "demo"
            ? "demo"
            : "legacy",
  );
  const age = (at: string | undefined) =>
    at
      ? `${buildDuration((now.value - Date.parse(at)) / 1000)} ago`
      : "Not reported";
  const cancelled = computed(
    () =>
      durable.value?.intent === "cancel" ||
      snapshot.value?.cancellationRequested === true,
  );
  const connectionError = computed(
    () =>
      (job.value && store.state?.runtime.durableBuildErrors?.[job.value.id]) ||
      (!hot.value ? durable.value?.reconcileError : undefined),
  );
  const disconnected = computed(() => Boolean(connectionError.value));
  const heading = computed(() => {
    if (legacy.value)
      return lifecycle.value === "mcp"
        ? "External MCP execution"
        : lifecycle.value === "herdr"
          ? "External Herdr session"
          : lifecycle.value === "demo"
            ? "Simulated Build"
            : "Legacy foreground attempt";
    if (identityMismatch.value) return "Worker identity needs attention";
    const value = snapshot.value;
    if (
      value?.phase === "completed" &&
      job.value?.status === "succeeded" &&
      (durable.value?.appliedSequence ?? -1) >= value.sequence
    )
      return "Build result saved — inspect for review";
    if (value?.phase === "cancelled" && job.value?.status === "cancelled")
      return "Cancellation confirmed";
    if (cancelled.value) {
      if (value?.phase === "cancelled" && job.value?.status === "cancelled")
        return "Cancellation confirmed";
      return disconnected.value || !value || value.phase === "attention"
        ? "Cancellation unconfirmed"
        : "Cancellation requested";
    }
    if (value?.phase === "completed")
      return job.value?.status === "failed"
        ? "Result needs attention"
        : "Result awaiting host save";
    if (disconnected.value) return "Build synchronization needs attention";
    if (!value)
      return job.value?.status === "queued"
        ? "Build queued"
        : "Waiting for worker confirmation";
    return phaseLabels[value.phase];
  });
  const inactivity = computed(() => {
    const value = snapshot.value;
    const warning =
      policy.value?.idleWarningSeconds ?? DEFAULT_DURABLE_IDLE_WARNING_SECONDS;
    if (
      !value ||
      !["starting", "running"].includes(value.phase) ||
      !warning ||
      cancelled.value
    )
      return "";
    const last = value.lastActivityAt ?? value.startedAt;
    return last && (now.value - Date.parse(last)) / 1000 >= warning
      ? `No activity has been reported for ${buildDuration((now.value - Date.parse(last)) / 1000)}. Check the original execution; inactivity does not establish failure.`
      : "";
  });
  async function check() {
    if (!durable.value || checking.value) return;
    const id = ideaId();
    const execution = durable.value.ref.executionId;
    checking.value = true;
    error.value = "";
    try {
      const ok = await actions.checkDurableBuild(id, runId());
      if (
        !ok &&
        ideaId() === id &&
        durable.value?.ref.executionId === execution
      )
        error.value =
          store.toasts.at(-1)?.message ??
          "The existing worker could not be checked.";
    } finally {
      checking.value = false;
    }
  }
  return reactive({
    job,
    snapshot,
    policy,
    legacy,
    lifecycle,
    heading,
    disconnected,
    connectionError,
    cancelled,
    inactivity,
    checking,
    error,
    identityMismatch,
    visible: computed(() => Boolean(job.value)),
    observed: computed(() =>
      snapshot.value
        ? phaseLabels[snapshot.value.phase]
        : "No verified worker snapshot",
    ),
    contact: computed(() => age(snapshot.value?.lastContactAt)),
    activity: computed(() => age(snapshot.value?.lastActivityAt)),
    elapsed: computed(() =>
      snapshot.value
        ? buildDuration(snapshot.value.elapsedSeconds)
        : "Not reported",
    ),
    queued: computed(() =>
      job.value?.status === "queued"
        ? buildDuration((now.value - Date.parse(job.value.startedAt)) / 1000)
        : "",
    ),
    deadline: computed(() =>
      policy.value?.maxRuntimeSeconds === undefined
        ? "No elapsed deadline"
        : buildDuration(policy.value.maxRuntimeSeconds),
    ),
    turns: computed(
      () => policy.value?.maxTurns ?? run.value?.definition.limits.maxTurns,
    ),
    budget: computed(
      () =>
        policy.value?.maxBudgetUsd ?? run.value?.definition.limits.maxBudgetUsd,
    ),
    reportedCost: computed(() => {
      const cost =
        snapshot.value?.costUsd ??
        snapshot.value?.result?.costUsd ??
        job.value?.costUsd;
      return cost === undefined
        ? "Not reported"
        : `USD${cost.toFixed(4)} reported`;
    }),
    legacyTimeout: computed(() => run.value?.definition.limits.timeoutSeconds),
    canCheck: computed(() => Boolean(durable.value)),
    acknowledgmentPending: computed(() =>
      Boolean(
        snapshot.value &&
        ["completed", "failed", "cancelled"].includes(snapshot.value.phase) &&
        ["succeeded", "failed", "cancelled"].includes(
          job.value?.status ?? "",
        ) &&
        (durable.value?.appliedSequence ?? -1) >= snapshot.value.sequence &&
        durable.value?.acknowledged !== true,
      ),
    ),
    canRecover: computed(() =>
      Boolean(
        durable.value &&
        durable.value.acknowledged !== true &&
        (disconnected.value ||
          identityMismatch.value ||
          snapshot.value?.phase === "attention"),
      ),
    ),
    check: () => {
      void check();
    },
  });
}
