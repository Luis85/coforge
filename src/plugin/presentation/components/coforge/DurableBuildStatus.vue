<script setup lang="ts">
import { useDurableBuildMonitor } from "../../composables/coforge/use-durable-build-monitor";
import DurableBuildRecovery from "./DurableBuildRecovery.vue";
const props = defineProps<{ ideaId: string; runId?: string }>();
const build = useDurableBuildMonitor(
  () => props.ideaId,
  () => props.runId,
);
</script>
<template>
  <section
    v-if="build.visible"
    class="cf-idea-section"
    :aria-label="
      build.legacy ? 'Build execution status' : 'Background Build status'
    "
  >
    <h3 aria-live="polite">{{ build.heading }}</h3>
    <template v-if="build.legacy">
      <template v-if="build.lifecycle === 'legacy'">
        <p class="cf-settings-help">
          This saved attempt used foreground execution<span
            v-if="build.legacyTimeout"
          >
            with its captured {{ build.legacyTimeout }} seconds timeout</span
          >. It has no background worker to attach to. Preserved results and
          partial changes remain available for inspection.
        </p>
        <p class="cf-settings-help">
          Enable background execution for future runs in the Build step. Saving
          that policy does not resume this attempt.
        </p>
      </template>
      <p v-else-if="build.lifecycle === 'mcp'" class="cf-settings-help">
        The connected MCP client drives this captured run. CoForge validates
        submitted results; it does not attach a native background worker to the
        client's process.
      </p>
      <p v-else-if="build.lifecycle === 'herdr'" class="cf-settings-help">
        Herdr owns this external session. A timeout or cancelled wait does not
        establish that the external agent stopped. Inspect its original session
        through Herdr recovery in Agent workflow → Step attempts.
      </p>
      <p v-else class="cf-settings-help">
        This is a simulated result, with no live provider process or background
        worker.
      </p>
    </template>
    <template v-else>
      <p
        v-if="build.disconnected || build.identityMismatch"
        class="cf-inline-error"
        role="status"
      >
        Last observed: {{ build.observed }}. This view has not reconciled the
        original Build. Check the existing execution and its reported error
        before deciding what to do next.
      </p>
      <p v-if="build.connectionError" class="cf-settings-help">
        {{ build.connectionError }}
      </p>
      <p v-else-if="build.canCheck" class="cf-settings-help">
        The admitted worker keeps its captured policy and profile when Obsidian
        closes. Reopening checks this same execution; it does not create another
        run.
      </p>
      <p v-else class="cf-settings-help">
        This Build is queued for capacity and admission checks. No background
        execution has been confirmed yet.
      </p>
      <p
        v-if="build.job?.status === 'queued' && build.job.error"
        class="cf-settings-help"
        role="status"
      >
        {{ build.job.error }} Review Project settings → Runtime for readiness
        and Vault integrations for admission limits.
      </p>
      <dl class="cf-settings-runtime-list">
        <div v-if="build.queued">
          <dt>Queued for</dt>
          <dd>{{ build.queued }}</dd>
        </div>
        <div>
          <dt>Observed elapsed time</dt>
          <dd>{{ build.elapsed }}</dd>
        </div>
        <div>
          <dt>Last contact</dt>
          <dd :title="build.snapshot?.lastContactAt">{{ build.contact }}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd :title="build.snapshot?.lastActivityAt">{{ build.activity }}</dd>
        </div>
        <div>
          <dt>Captured deadline</dt>
          <dd>{{ build.deadline }}</dd>
        </div>
        <div>
          <dt>Captured resource bounds</dt>
          <dd>
            {{ build.turns ?? "Not recorded" }} turns/tool calls ·
            {{
              build.budget === undefined
                ? "USD cap not recorded"
                : `USD${build.budget}`
            }}
          </dd>
        </div>
        <div>
          <dt>Cost information</dt>
          <dd>{{ build.reportedCost }}</dd>
        </div>
      </dl>
      <p class="cf-settings-help">
        Contact confirms observation, not completed work. Activity and elapsed
        time do not provide a completion percentage or ETA.
      </p>
      <p v-if="build.job?.provider === 'codex'" class="cf-settings-help">
        Codex does not enforce the USD spending cap. Token usage and tool-call
        limits remain distinct from reported billing.
      </p>
      <p v-if="build.inactivity" class="cf-workflow-policy" role="status">
        {{ build.inactivity }}
      </p>
      <p v-if="build.cancelled" class="cf-settings-help">
        The Stop hold remains in Inbox. Checking recovery does not release it;
        only the operator's Restart action can start a fresh run after
        cancellation is settled.
      </p>
      <p
        v-if="build.acknowledgmentPending"
        class="cf-workflow-policy"
        role="status"
      >
        Worker acknowledgment pending. The saved result is retained; checking
        the original execution can confirm its acknowledgment without applying
        the result again.
      </p>
      <p v-if="build.error" class="cf-inline-error" role="alert">
        {{ build.error }}
      </p>
      <p
        v-if="
          build.snapshot?.error &&
          build.snapshot.error !== build.connectionError
        "
        class="cf-inline-error"
        role="alert"
      >
        {{ build.snapshot.error }}
      </p>
      <button
        v-if="build.canCheck"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="build.checking"
        @click="build.check()"
      >
        {{
          build.checking ? "Checking existing Build…" : "Check existing Build"
        }}
      </button>
      <DurableBuildRecovery
        v-if="build.canRecover"
        :idea-id="props.ideaId"
        :run-id="props.runId"
        :job="build.job"
      />
      <details v-if="build.snapshot?.logs.length" class="cf-workflow-options">
        <summary>Recent worker activity</summary>
        <pre class="cf-workflow-code-block" tabindex="0">{{
          build.snapshot.logs.join("\n")
        }}</pre>
      </details>
    </template>
  </section>
</template>
