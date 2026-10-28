<script setup lang="ts">
import { useCouncilModel } from "../../composables/coforge/use-council";
import MarkdownBody from "./MarkdownBody.vue";
import CouncilRecoveryTools from "./CouncilRecoveryTools.vue";
const model = useCouncilModel();
</script>
<template>
  <section class="cf-council-section" aria-label="Council run monitor">
    <h2>Runs and recovery</h2>
    <p role="status" aria-live="polite" aria-atomic="true" class="cf-sr-only">
      {{ model.progressAnnouncement }}
    </p>
    <div class="cf-council-fields">
      <label class="cf-field"
        ><span>Project filter</span
        ><select v-model="model.store.projectFilter">
          <option value="">All projects</option>
          <option
            v-for="project in model.studio.state?.projects"
            :key="project.id"
            :value="project.id"
          >
            {{ project.settings.projectName }}
          </option>
        </select></label
      ><label class="cf-field"
        ><span>State filter</span
        ><select v-model="model.store.stateFilter">
          <option value="">All states</option>
          <option
            v-for="state in [
              'queued',
              'running',
              'publishing',
              'waiting-human',
              'attention',
              'completed',
              'cancelled',
              'awaiting-review',
            ]"
            :key="state"
            :value="state"
          >
            {{ state }}
          </option>
        </select></label
      >
    </div>
    <p v-if="model.store.teamFilter || model.store.targetFilter">
      Existing project workflows have no reusable-agent or team identity and are
      excluded by these filters.
    </p>
    <div class="cf-council-fields">
      <label class="cf-field"
        ><span>Team filter</span
        ><input v-model="model.store.teamFilter" placeholder="Exact team ID"
      /></label>
      <label class="cf-field"
        ><span>Agent filter</span
        ><input
          v-model="model.store.targetFilter"
          placeholder="Agent ID contains…"
      /></label>
      <label class="cf-field"
        ><span>Source filter</span
        ><input
          v-model="model.store.sourceFilter"
          placeholder="Source ID contains…"
      /></label>
    </div>
    <p v-if="!model.runs.length && !model.legacyRuns.length">
      No matching runs. Submit a private note or activate a watched inbox to
      begin.
    </p>
    <ol class="cf-council-runs">
      <li v-for="run in model.runs" :key="run.id">
        <div>
          <strong>{{ run.subject.sourceId }}</strong
          ><span>
            · {{ model.runState(run)
            }}{{ run.pauseRequested ? " · Paused" : "" }} · {{ run.cursor }}/{{
              run.invocations.length
            }}
            steps completed or skipped</span
          >
        </div>
        <p>
          {{ run.invocations[run.cursor]?.roundId }}
          {{ run.invocations[run.cursor]?.agentId }}
        </p>
        <p v-if="run.reason" role="status">{{ run.reason }}</p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-ghost"
            @click="model.store.inspectedRun = run.id"
          >
            Inspect captured evidence</button
          ><button
            v-if="run.state === 'publishing'"
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="model.store.busy || !model.store.state?.executor || run.attempts.some(attempt => attempt.status === 'dispatching')"
            @click="model.repair(run.id)"
          >
            Repair note publication</button
          ><button
            v-if="run.state === 'queued' || run.state === 'running'"
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.store.busy"
            @click="model.pauseRun(run.id, !run.pauseRequested)"
          >
            {{
              run.pauseRequested ? "Resume this run" : "Pause this run"
            }}</button
          ><button
            v-if="run.state !== 'completed' && run.state !== 'cancelled'"
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.store.busy"
            @click="model.cancel(run.id)"
          >
            Cancel future work</button
          ><button
            v-if="run.state === 'completed' || run.state === 'cancelled'"
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.store.busy"
            @click="model.runAgain(run.subject.sourceId)"
          >
            Run again as new generation
          </button>
        </div>
      </li>
    </ol>
    <section
      v-if="model.legacyRuns.length"
      aria-label="Existing project workflows"
    >
      <h3>Existing project workflows</h3>
      <ul>
        <li v-for="run in model.legacyRuns" :key="run.id">
          {{ run.sourceId }} · {{ run.state }} · {{ run.currentAction }} ·
          {{ run.contributions }} retained results
          <p v-if="run.reason">{{ run.reason }}</p>
        </li>
      </ul>
      <p>
        Use Agent workflow for existing workflow controls and final code review.
      </p>
    </section>
    <section v-if="model.selectedRun" aria-label="Captured run evidence">
      <h3>Run {{ model.selectedRun.id }}</h3>
      <p>
        Project {{ model.selectedRun.projectId }} · Team
        {{ model.selectedRun.teamId }} · Source revision
        {{ model.selectedRun.subject.revision }}
      </p>
      <form
        v-if="model.checkpoint"
        @submit.prevent="model.completeCheckpoint()"
      >
        <h4>{{ model.checkpoint.name }}</h4>
        <p>{{ model.checkpoint.instructions }}</p>
        <label
          v-for="item in model.checkpoint.items"
          :key="item.id"
          class="cf-council-choice"
          ><input
            v-model="model.store.checkpointItems"
            type="checkbox"
            :value="item.id"
          />{{ item.label }}{{ item.required ? " (required)" : "" }}</label
        >
        <label class="cf-field"
          ><span>Checkpoint decision note</span
          ><textarea v-model="model.store.checkpointNote" maxlength="3000" />
        </label>
        <p>
          Continuing acknowledges this checkpoint. Actual code changes still
          require final host review.
        </p>
        <button
          type="submit"
          class="cf-btn cf-btn-primary"
          :disabled="model.store.busy"
        >
          Acknowledge and continue
        </button>
      </form>
      <template v-if="model.selectedRun.state === 'attention'"
        ><p v-if="model.settling" role="status">Wait for all active round members to settle before retrying, continuing or skipping. Pause and cancel remain available.</p><label
          ><input v-model="model.store.acknowledge" type="checkbox" /> I
          inspected any uncertain external attempt. Retrying may produce another
          provider charge.</label
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || model.settling"
          @click="model.retry(model.selectedRun.id)"
        >
          Retry eligible action</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || model.settling"
          @click="model.continueSnapshot(model.selectedRun.id)"
        >
          Continue using original snapshot
        </button>
        <details>
          <summary>Skip under the configured partial policy</summary>
          <label class="cf-field"
            ><span>Reason for missing contribution</span
            ><textarea
              v-model="model.store.skipReason"
              maxlength="2000"
            /></label
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.store.busy || model.settling || !model.store.skipReason.trim()"
            @click="model.skip(model.selectedRun.id)"
          >
            Record missing contribution
          </button>
          <p>
            The host blocks skipping unless this round's declared minimum can
            still be met.
          </p>
        </details></template
      >
      <details>
        <summary>Captured input</summary>
        <pre>{{ model.selectedRun.subject.markdown }}</pre>
        <pre>{{ model.selectedRun.context }}</pre>
      </details>
      <article
        v-for="artifact in model.selectedRun.artifacts"
        :key="artifact.id"
      >
        <h4>{{ model.artifactLabel(model.selectedRun, artifact) }}</h4>
        <p>
          {{ artifact.skipped ? "Missing contribution · " : ""
          }}{{ artifact.simulated ? "Simulation · " : ""
          }}{{ artifact.provider }} / {{ artifact.model }} ·
          {{ artifact.createdAt }} ·
          {{
            artifact.costUsd === undefined
              ? "Cost unknown"
              : `$${artifact.costUsd.toFixed(4)} USD reported`
          }}
        </p>
        <MarkdownBody :source="artifact.markdown" />
        <p
          v-if="artifact.messageRejection"
          role="status"
          class="cf-inline-error"
        >
          Contribution retained; outgoing messages blocked.
          {{ artifact.messageRejection.reason }}
        </p>
        <p v-else-if="artifact.messagesRejected" role="status">
          Contribution retained; outgoing messages were rejected. Inspect the
          retained drafts and current policy before requesting more work.
        </p>
        <details>
          <summary>Attribution and included inputs</summary>
          <pre>{{ JSON.stringify(artifact, null, 2) }}</pre>
        </details>
      </article>
      <details>
        <summary>Attempt history</summary>
        <pre>{{ JSON.stringify(model.selectedRun.attempts, null, 2) }}</pre>
      </details>
      <CouncilRecoveryTools />
    </section>
  </section>
</template>
