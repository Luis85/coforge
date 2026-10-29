<script setup lang="ts">
import { useCouncilModel } from "../../composables/coforge/use-council";
import CouncilSimulationPanel from "./CouncilSimulationPanel.vue";
import CouncilRoundSchedule from "./CouncilRoundSchedule.vue";
withDefaults(defineProps<{ taskIntake?: boolean }>(), { taskIntake: false });
const model = useCouncilModel();
</script>
<template>
  <section
    :aria-label="
      taskIntake
        ? 'Review Council task'
        : model.store.tab === 'inboxes'
          ? 'Configure watched inbox'
          : 'Submit a note'
    "
    class="cf-council-section"
  >
    <h2>
      {{
        taskIntake
          ? "Review your saved task"
          : model.store.tab === "inboxes"
            ? "Route a private inbox"
            : "Choose a note and preview its run"
      }}
    </h2>
    <label v-if="model.store.tab === 'inboxes'" class="cf-field"
      ><span>Inbox destination type</span
      ><select v-model="model.store.inboxKind">
        <option value="agent-council">Agent or council</option>
        <option value="workflow">Project proposal workflow</option>
        <option value="team">Team information board</option>
      </select></label
    >
    <div v-if="!taskIntake" class="cf-council-fields">
      <label class="cf-field"
        ><span>Project team</span
        ><select v-model="model.store.team">
          <option value="">Select team</option>
          <option
            v-for="entry in model.teams"
            :key="entry.definition.id"
            :value="entry.definition.id"
          >
            {{ entry.definition.name }}
          </option>
        </select></label
      ><label
        v-if="
          model.store.tab !== 'inboxes' ||
          model.store.inboxKind === 'agent-council'
        "
        class="cf-field"
        ><span>Agent or council</span
        ><select v-model="model.store.target">
          <option value="">Select destination</option>
          <option
            v-for="entry in model.targets"
            :key="entry.definition.id"
            :value="entry.definition.id"
          >
            {{ entry.definition.name }} ·
            {{ entry.definition.schema.split("/")[0] }}
          </option>
        </select></label
      >
    </div>
    <template v-if="taskIntake || model.store.tab === 'submit'">
      <label class="cf-field"
        ><span>Private source note</span
        ><input
          v-model="model.store.source"
          :readonly="taskIntake"
          placeholder="CoForge/Requests/Proposal.md"
      /></label>
      <div class="cf-settings-actions">
        <button
          v-if="!taskIntake"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || !model.store.source"
          @click="model.markSource(model.store.source, true)"
        >
          Mark source Draft</button
        ><button
          v-if="!taskIntake"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || !model.store.source"
          @click="model.markSource(model.store.source, false)"
        >
          Mark source Ready
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            model.store.busy || !model.store.source || !model.store.target
          "
          @click="model.preflight()"
        >
          Run preflight</button
        ><button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="
            model.store.busy ||
            !model.store.preview ||
            !model.store.state?.executor ||
            (taskIntake && model.ask.simulationPreview)
          "
          @click="model.submit()"
        >
          {{ taskIntake ? "Submit reviewed task" : "Submit captured note" }}
        </button>
      </div>
      <p v-if="taskIntake && model.ask.simulationPreview" class="cf-settings-help">This council includes simulation agents. Use the explicit test destination below to queue marked test output; these agents cannot submit a real run.</p>
      <section v-if="model.store.preview" aria-label="Invocation preview">
        <h3>
          {{ model.store.preview.plan.definition.name }} ·
          {{ model.store.preview.invocations }} invocations
        </h3>
        <p>
          Root allowance:
          {{ model.store.preview.plan.definition.limits.maxInvocations }}
          dispatches including retries and descendants;
          {{ model.store.preview.plan.definition.limits.maxExecutionSeconds }}
          seconds of active execution;
          {{ model.store.preview.plan.definition.limits.maxArtifactCharacters }}
          characters per contribution.
        </p>
        <p v-if="model.store.preview.executionLimits">
          Native Claude limits per invocation:
          {{ model.store.preview.executionLimits.timeoutSeconds }} seconds,
          {{ model.store.preview.executionLimits.maxTurns }} turns, USD
          {{ model.store.preview.executionLimits.maxBudgetUsd.toFixed(2) }}.
          These are per-call limits, not a promised total cost. Simulation makes
          no model request.
        </p>
        <p>
          Source revision: <code>{{ model.store.preview.source.revision }}</code
          >. Context is captured once. Opinion rounds have no project or vault
          tools; each call starts without provider history.
        </p>
        <ol>
          <li
            v-for="invocation in model.store.preview.plan.invocations"
            :key="invocation.id"
          >
            {{ invocation.roundName }} · {{ invocation.agent.name }} ·
            {{ invocation.agent.provider }} / {{ invocation.agent.model
            }}<span v-if="invocation.inputs.length">
              · collections: {{ invocation.inputs.join(", ") }}</span
            >
          </li>
        </ol>
          <CouncilRoundSchedule :rounds="model.store.preview.plan.definition.rounds" />
          <details>
            <summary>Captured source and context</summary>
          <pre>{{ model.store.preview.source.markdown }}</pre>
          <pre>{{ model.store.preview.context }}</pre>
        </details>
      </section>
      <CouncilSimulationPanel :task-intake="taskIntake" />
    </template>
    <template v-else>
      <label class="cf-field"
        ><span>Private inbox folder</span
        ><input
          v-model="model.store.inboxPath"
          placeholder="CoForge/Inboxes/Councils/Design"
      /></label>
      <label
        ><input v-model="model.store.recursive" type="checkbox" /> Include
        subfolders</label
      ><label
        ><input v-model="model.store.readyOnly" type="checkbox" /> Require the
        note's Ready property</label
      >
      <p>
        Nonempty notes settle for two seconds. Draft prevents submission.
        Generated result writes and ordinary edits keep the same submission
        generation.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        :disabled="
          model.store.busy ||
          !model.store.state?.executor ||
          (model.store.inboxKind === 'agent-council' && !model.store.target) ||
          !model.store.team ||
          !model.store.inboxPath
        "
        @click="model.saveInbox()"
      >
        Save inbox binding
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.newInbox()"
      >
        New inbox
      </button>
      <p v-if="model.store.inboxKind === 'workflow'">
        Save the selected project's proposal workflow first. Its subject mode
        and explicit bindings control admission.
      </p>
      <p v-if="model.store.inboxKind === 'team'">
        Submitted notes become team information. They never start provider work
        or broadcast tasks.
      </p>
      <h3>Configured inboxes</h3>
      <p v-if="!model.store.state?.preferences.bindings.length">
        No inboxes configured. Save a destination, then preview existing notes
        before activation.
      </p>
      <ul>
        <li
          v-for="binding in model.store.state?.preferences.bindings"
          :key="binding.id"
        >
          <strong>{{ binding.path }}</strong> → {{ binding.target.id }}
          <button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.store.busy"
            @click="model.prepareReset(binding.id)"
          >
            Reset activation
          </button>
          <span> · {{ binding.enabled ? "Enabled" : "Paused" }}</span
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.store.busy"
            @click="model.editInbox(binding)"
          >
            Edit inbox</button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.store.busy"
            @click="model.toggleInbox(binding)"
          >
            {{ binding.enabled ? "Pause inbox" : "Enable inbox" }}
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.store.busy"
            @click="model.previewInbox(binding.id)"
          >
            Preview existing notes
          </button>
        </li>
      </ul>
      <section
        v-if="model.store.resetInboxId"
        aria-label="Reset inbox activation"
      >
        <h3>Reset {{ model.resetTarget() }}</h3>
        <p>
          This pauses this inbox and removes its activation baseline. It
          preserves notes, history and submission tombstones. Previously
          processed generations cannot replay; unprocessed backlog can enter
          only after a new preview and explicit activation. Existing runs retain
          their snapshots.
        </p>
        <label
          ><input v-model="model.store.resetInboxConfirmed" type="checkbox" />
          Reset activation for {{ model.resetTarget() }}.</label
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || !model.store.resetInboxConfirmed"
          @click="model.resetInbox()"
        >
          Confirm inbox reset
        </button>
      </section>
      <section
        v-if="model.store.inboxPreviewed"
        aria-label="Existing inbox notes"
      >
        <h3>Choose existing backlog</h3>
        <p>
          Leave all unchecked to watch new arrivals only. After activation,
          execution stays paused until resumed.
        </p>
        <div
          v-for="note in model.store.inboxPreview"
          :key="note.path"
          class="cf-council-choice"
        >
          <label
            ><input
              v-model="model.store.inboxSelection"
              type="checkbox"
              :value="note.sourceId ?? note.path"
              :disabled="!!note.error"
            />{{ note.path }}<span v-if="note.error"> · Needs repair</span
            ><span v-else>
              ·
              {{
                note.draft ? "Draft" : note.ready ? "Ready" : "Not marked Ready"
              }}</span
            ></label
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.store.busy || !!note.error"
            @click="model.markSource(note.path, true)"
          >
            Mark Draft</button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="
              model.store.busy || !!note.error || note.hasHumanContent === false
            "
            @click="model.markSource(note.path, false)"
          >
            Mark Ready
          </button>
        </div>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || !model.store.state?.executor"
          @click="model.activateInbox()"
        >
          Activate with selected backlog
        </button>
      </section>
      <ul aria-label="Intake status">
        <li v-for="item in model.store.state?.intake" :key="item.path">
          {{ item.path }} · {{ item.status
          }}<span v-if="item.reason"> · {{ item.reason }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>
