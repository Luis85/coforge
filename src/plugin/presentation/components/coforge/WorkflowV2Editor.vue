<script setup lang="ts">
import type { CouncilCatalogueActions } from "../../../features/coforge/application/council-catalogue";
import type { WorkflowV2Actions } from "../../../features/coforge/application/workflow-v2-ports";
import { useWorkflowV2Editor } from "../../composables/coforge/use-workflow-v2-editor";
import { useEventTriggerLink } from "../../composables/coforge/use-event-trigger-link";
import WorkflowV2Steps from "./WorkflowV2Steps.vue";
import WorkflowV2Transfer from "./WorkflowV2Transfer.vue";
import WorkflowOutputTemplates from "./WorkflowOutputTemplates.vue";
const props = defineProps<{
  actions: WorkflowV2Actions;
  catalogue: CouncilCatalogueActions;
  projectId: string;
}>();
const model = useWorkflowV2Editor(props);
const openEventTriggers = useEventTriggerLink();
</script>
<template>
  <section
    class="cf-council-definitions"
    aria-label="Proposal workflow settings"
  >
    <header class="cf-page-heading">
      <div>
        <h2>Proposal workflows</h2>
        <p>
          Turn a private note or existing request into a sequence of CoWorker
          answers, Council discussions and your decisions. This process is
          separate from the request workflow.
        </p>
      </div>
    </header>
    <p v-if="model.store.error" class="cf-inline-error" role="alert">
      {{ model.store.error }}
    </p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    <p class="cf-settings-help">
      Generic note subjects carry no viewer identity, votes, rewards or code
      approval. Final host review remains required for actual implementation
      changes.
    </p>
    <div class="cf-settings-actions">
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.load()"
      >
        Reload saved proposal workflow</button
      ><span>{{ model.dirty ? "Unsaved changes" : "Saved definition" }}</span>
      <button
        v-if="model.dirty"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.discard()"
      >
        Discard proposal draft
      </button>
    </div>
    <div v-if="!model.store.draft" class="cf-empty-state">
      <h3>Create a proposal process</h3>
      <p>
        Your existing project workflow stays available in Workflow settings. Add
        a separate CoWorker process here when you need explicit council results
        or generic note inputs.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        aria-label="Create proposal workflow"
        :disabled="model.store.busy || !projectId"
        @click="model.create()"
      >
        Create proposal workflow
      </button>
    </div>
    <form v-else @submit.prevent="model.save()">
      <fieldset :disabled="model.store.busy">
        <legend class="cf-sr-only">Configure proposal workflow</legend>
        <label class="cf-field"
          ><span>Workflow name</span
          ><input
            v-model="model.store.draft.name"
            aria-label="Proposal workflow name"
            maxlength="100"
            required
        /></label>
        <div class="cf-council-fields">
          <label class="cf-field"
            ><span>Project team</span
            ><select v-model="model.store.draft.teamId">
              <option value="">Select team</option>
              <option
                v-for="team in model.teams"
                :key="team.definition.id"
                :value="team.definition.id"
              >
                {{ team.definition.name }}
              </option>
            </select></label
          ><label class="cf-field"
            ><span>Input note</span
            ><select v-model="model.store.draft.subjectMode">
              <option value="note">Generic private note</option>
              <option value="idea">Explicit existing Idea note</option>
            </select></label
          >
        </div>
        <p v-if="!model.teams.length" class="cf-inline-error">
          Create a project roster in Setup → Councils &amp; roster before saving an executable
          proposal workflow.
        </p>
        <p class="cf-workflow-policy">
          {{ model.store.draft.steps.length }} ordered steps. Open a step to
          edit its task and answer. Saving prepares future runs; it never starts
          work.
        </p>
        <WorkflowV2Steps />
        <details>
          <summary>Combine results from several steps</summary>
          <p class="cf-settings-help">
            Collections contain every contribution of their selected producers,
            in the listed order. Bind them only to later steps.
          </p>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.addCollection()"
          >
            Add collection
          </button>
          <div
            v-for="(collection, index) in model.store.draft.collections"
            :key="collection.id"
            class="cf-council-round"
          >
            <h3>Collection {{ index + 1 }}</h3>
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              @click="model.store.draft.collections.splice(index, 1)"
            >
              Remove collection
            </button>
            <fieldset>
              <legend>Include results from these steps</legend>
              <template v-for="step in model.store.draft.steps" :key="step.id"
                ><label
                  v-if="step.kind === 'agent' || step.kind === 'council'"
                  class="cf-check"
                  ><input
                    type="checkbox"
                    :checked="collection.producers.includes(step.id)"
                    @change="model.toggleProducer(collection, step.id)"
                  />{{ step.name }}</label
                ></template
              >
            </fieldset>
            <ol>
              <li
                v-for="(producer, position) in collection.producers"
                :key="producer"
              >
                <span>{{ model.stepName(producer) }}</span>
                ><button
                  type="button"
                  class="cf-btn cf-btn-ghost"
                  :disabled="position === 0"
                  @click="model.move(collection.producers, position, -1)"
                >
                  Earlier</button
                ><button
                  type="button"
                  class="cf-btn cf-btn-ghost"
                  :disabled="position === collection.producers.length - 1"
                  @click="model.move(collection.producers, position, 1)"
                >
                  Later
                </button>
              </li>
            </ol>
            <details class="cf-workflow-reference">
              <summary>Collection reference</summary>
              <code>{{ collection.id }}</code>
            </details>
          </div>
        </details>
        <details>
          <summary>Execution limits</summary>
          <div class="cf-council-fields">
            <label class="cf-field"
              ><span>Timeout per invocation, seconds</span
              ><input
                v-model.number="model.store.draft.limits.timeoutSeconds"
                type="number"
                min="15"
                max="1800" /></label
            ><label class="cf-field"
              ><span>Maximum native provider turns</span
              ><input
                v-model.number="model.store.draft.limits.maxTurns"
                type="number"
                min="1"
                max="50" /></label
            ><label class="cf-field"
              ><span>Maximum native provider budget, USD</span
              ><input
                v-model.number="model.store.draft.limits.maxBudgetUsd"
                type="number"
                min="0.1"
                max="20"
                step="0.1" /></label
            ><label class="cf-field"
              ><span>Maximum expanded invocations</span
              ><input
                v-model.number="model.store.draft.limits.maxInvocations"
                type="number"
                min="1"
                max="100"
            /></label>
          </div>
        </details>
        <button type="submit" class="cf-btn cf-btn-primary">
          Save proposal workflow
        </button>
      </fieldset>
    </form>
    <WorkflowOutputTemplates
      :project-id="projectId"
      @changed="model.templateChanged()"
    />
    <WorkflowV2Transfer />
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="openEventTriggers()"
    >
      Attach an event trigger
    </button>
    <section
      v-if="model.store.revision"
      aria-label="Proposal workflow preflight"
    >
      <h3>Preview a submitted note</h3>
      <label class="cf-field"
        ><span>Private workflow source note</span
        ><input
          v-model="model.store.source"
          placeholder="CoForge/Requests/Proposal.md" /></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || model.dirty || !model.store.source"
        @click="model.preflight()"
      >
        Preflight proposal workflow
      </button>
      <p v-if="model.dirty" class="cf-settings-help">
        Save changes before previewing the executable definition.
      </p>
      <section
        v-if="model.store.preview"
        aria-label="Proposal invocation preview"
      >
        <p>
          {{ model.store.preview.invocations }} invocations and
          {{ model.store.preview.plan.checkpoints.length }} human checkpoints.
          Source revision <code>{{ model.store.preview.source.revision }}</code
          >.
        </p>
        <ol>
          <li
            v-for="invocation in model.store.preview.plan.invocations"
            :key="invocation.id"
          >
            {{ invocation.roundId }} · {{ invocation.agentId }} ·
            {{ invocation.provider }} / {{ invocation.model }}
          </li>
        </ol>
        <details class="cf-workflow-captured-instructions">
          <summary>Captured step instructions</summary>
          <section
            v-for="invocation in model.store.preview.plan.invocations"
            :key="invocation.id"
          >
            <h4>{{ invocation.agentId }} · {{ invocation.roundId }}</h4>
            <pre
              class="cf-workflow-json"
              tabindex="0"
              :aria-label="`Captured instructions for ${invocation.id}`"
              >{{ invocation.instructions }}</pre>
          </section>
        </details>
        <details>
          <summary>Captured input and context</summary>
          <pre>{{ model.store.preview.source.markdown }}</pre>
          <pre>{{ model.store.preview.context }}</pre>
        </details>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="model.store.busy || model.dirty"
          @click="model.start()"
        >
          Submit proposal workflow
        </button>
      </section>
      <details>
        <summary>Simulate proposal workflow</summary>
        <p>
          Writes marked fake outputs to a new explicit test note. Human
          checkpoints still require input in Activity → Runs &amp; answers.
        </p>
        <label class="cf-field"
          ><span>Proposal simulation destination</span
          ><input
            v-model="model.store.destination"
            placeholder="CoForge/Tests/Workflow trial.md" /></label
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            model.store.busy ||
            model.dirty ||
            !model.store.source ||
            !model.store.destination
          "
          @click="model.start(true)"
        >
          Queue proposal simulation
        </button>
      </details>
    </section>
  </section>
</template>
