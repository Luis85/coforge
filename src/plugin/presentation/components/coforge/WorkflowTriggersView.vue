<script setup lang="ts">
import { useWorkflowTriggers } from "../../composables/coforge/use-workflow-triggers";
const model = useWorkflowTriggers();
</script>
<template>
  <section class="cf-council-section" aria-label="Workflow event triggers">
    <h2>Event triggers</h2>
    <p>
      Start a saved workflow when a project or application event occurs. Only
      future events while this execution desktop is open are considered.
    </p>
    <p v-if="!model.available">
      Open desktop Obsidian to configure event triggers.
    </p>
    <button v-if="!model.available && model.canPreview" type="button" class="cf-btn cf-btn-secondary" @click="model.explore()">Explore event-trigger example</button>
    <p v-if="model.form.example" role="status">Event-trigger example · memory only. No vault writes or provider dispatch.</p>
    <template v-if="model.available">
      <p
        v-if="model.error || model.snapshot?.error"
        role="alert"
        class="cf-inline-error"
      >
        {{ model.error || model.snapshot?.error }}
      </p>
      <p v-if="model.notice" role="status">{{ model.notice }}</p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.busy"
        @click="model.refresh()"
      >
        Refresh trigger journal
      </button>
      <p v-if="!model.owned">
        Designate this desktop in Run monitor before changing triggers.
      </p>
      <form @submit.prevent="model.save()">
        <fieldset
          class="cf-task-form"
          :disabled="model.busy || !model.owned"
        >
          <legend>{{ model.form.id ? "Edit trigger" : "New trigger" }}</legend>
          <label class="cf-field"
            ><span>Trigger name</span
            ><input v-model="model.form.draft.name" maxlength="100" required
          /></label>
          <div class="cf-workflow-field-grid">
            <label class="cf-field"
              ><span>Event</span
              ><select v-model="model.form.draft.event">
                <option
                  v-for="event in model.events"
                  :key="event"
                  :value="event"
                >
                  {{ event }}
                </option>
              </select></label
            >
            <label class="cf-field"
              ><span>Listen to</span
              ><select v-model="model.form.draft.scope">
                <option value="project">Target project only</option>
                <option value="application">
                  All projects and application
                </option>
              </select></label
            >
            <label class="cf-field"
              ><span>Target project</span
              ><select v-model="model.form.draft.projectId" required>
                <option value="">Select project</option>
                <option
                  v-for="project in model.projects"
                  :key="project.id"
                  :value="project.id"
                >
                  {{ project.settings.projectName }}
                </option>
              </select></label
            >
            <label class="cf-field"
              ><span>Workflow</span
              ><select v-model="model.form.draft.workflow">
                <option value="v1">
                Project workflow
                </option>
                <option value="v2">Council workflow</option>
              </select></label
            >
          </div>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.form.draft.projectId"
            @click="model.review()"
          >
            Review saved workflow
          </button>
          <p v-if="model.reviewedName" role="status">
            {{ model.reviewedName }} · revision
            {{ model.form.draft.workflowRevision }}
          </p>
          <template v-if="model.subject === 'idea'">
            <label class="cf-field"
              ><span>Request context</span
              ><select v-model="model.form.draft.request">
                <option value="event">Existing request from the event</option>
                <option value="fixed">One selected request</option>
              </select></label
            >
            <label v-if="model.form.draft.request === 'fixed'" class="cf-field"
              ><span>Request</span
              ><select v-model="model.form.draft.ideaId" required>
                <option value="">Select request</option>
                <option
                  v-for="idea in model.ideas"
                  :key="idea.id"
                  :value="idea.id"
                >
                  {{ idea.id }} · {{ idea.title }}
                </option>
              </select></label
            >
            <p class="cf-settings-help">
              An event without a request from the target project is skipped.
              Triggers never invent an Idea or approve code changes.
            </p>
          </template>
          <p v-else class="cf-settings-help">
            This workflow receives a private note containing the captured event
            context.
          </p>
          <label class="cf-field"
            ><span>Minimum seconds between runs</span
            ><input
              v-model.number="model.form.draft.cooldownSeconds"
              type="number"
              min="1"
              max="86400"
              required
          /></label>
          <label class="cf-workflow-check"
            ><input v-model="model.form.draft.enabled" type="checkbox" />Enable
            future matching events</label
          >
          <label v-if="model.form.id" class="cf-workflow-check"
            ><input v-model="model.form.acknowledge" type="checkbox" />I
            inspected uncertain admissions and their original runs before
            enabling this trigger again.</label
          >
          <div class="cf-settings-actions">
            <button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="!model.form.draft.workflowRevision"
            >
              {{ model.busy ? "Saving…" : "Save trigger" }}</button
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.reset()"
            >
              New trigger
            </button>
          </div>
        </fieldset>
      </form>
      <h3>Saved triggers</h3>
      <p v-if="!model.snapshot?.bindings.length">
        No triggers yet. Save a workflow, then choose the event that should
        start it.
      </p>
      <ul v-else>
        <li v-for="binding in model.snapshot.bindings" :key="binding.id">
          <strong>{{ binding.name }}</strong> ·
          {{ binding.enabled ? "Enabled" : "Disabled" }} · {{ binding.event }} →
          {{ binding.projectId }} / {{ binding.workflow }}
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.busy || !model.owned"
            @click="model.edit(binding)"
          >
            Edit
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.busy || !model.owned"
            @click="model.remove(binding)"
          >
            Remove
          </button>
        </li>
      </ul>
      <details>
        <summary>
          Recent event decisions · {{ model.snapshot?.occurrences.length ?? 0 }}
        </summary>
        <p>
          Paused execution, cooldowns and overlapping runs skip that event.
          Changes to a saved workflow disable its trigger until you review the
          new revision.
        </p>
        <ul>
          <li v-for="occurrence in model.occurrences" :key="occurrence.id">
            <strong
              >{{ occurrence.snapshot.name }} · {{ occurrence.status }}</strong
            >
            <p>
              {{ occurrence.event.type }} · {{ occurrence.event.at }} ·
              {{ occurrence.reason }}
            </p>
            <code v-if="occurrence.sourcePath">{{ occurrence.sourcePath }}</code
            ><button
              v-if="occurrence.runId && occurrence.snapshot.workflow === 'v2'"
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.monitor(occurrence.runId)"
            >
              Inspect run</button
            ><code v-else-if="occurrence.runId">{{ occurrence.runId }}</code>
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>
