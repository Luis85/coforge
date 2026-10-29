<script setup lang="ts">
import { useCouncilModel } from "../../composables/coforge/use-council";
import CouncilSubmission from "./CouncilSubmission.vue";
import CouncilExecutionControls from "./CouncilExecutionControls.vue";
import CouncilRecipients from './CouncilRecipients.vue';
import VaultFilePicker from './VaultFilePicker.vue';
const model = useCouncilModel();
</script>
<template>
  <div class="cf-council-ask">
    <section
      class="cf-council-task-composer"
      aria-label="Ask the Council for advice"
    >
      <header>
        <h2>Ask for advice or an opinion</h2>
        <p>
          Describe the decision or problem. Review the council, captured
          question and planned rounds before submitting.
        </p>
      </header>
      <p v-if="!model.service" class="cf-settings-help">
        Save and submit private tasks in desktop Obsidian, or explore the
        explicitly labelled Council example.
      </p>
      <p
        v-if="
          model.store.taskProjectId &&
          model.store.taskProjectId !== model.projectId
        "
        role="status"
        class="cf-inline-error"
      >
        This draft belongs to {{ model.store.taskProjectId }}. Select that
        project or start a new task; your question is kept.
      </p>
      <section
        v-if="model.store.pendingIdeaAssessment"
        class="cf-council-draft-choice"
        aria-label="Replace Council draft"
      >
        <h3>
          Assess {{ model.store.pendingIdeaAssessment.linkedIdea.ideaId }} ·
          {{ model.store.pendingIdeaAssessment.title }}
        </h3>
        <p>
          Your current draft “{{ model.store.taskTitle || "Untitled task" }}” is
          kept. Replace it with an assessment of this request?
        </p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.ask.linkedDraft.applying"
            @click="model.ask.linkedDraft.keep()"
          >
            Keep current draft
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="model.store.busy || model.ask.linkedDraft.applying"
            @click="model.ask.linkedDraft.replace()"
          >
            Replace draft with item assessment
          </button>
        </div>
      </section>
      <p
        v-if="model.store.taskLinkedIdea"
        class="cf-settings-help"
        role="status"
      >
        Linked request: {{ model.store.taskLinkedIdea.ideaId }} · its captured
        version is checked again before admission and every provider call.
        Assessment only; the request's plan and status stay under their existing
        controls.
      </p>
      <form @submit.prevent="model.ask.save()">
        <fieldset
          :disabled="
            model.store.busy || model.ask.linkedDraft.applying || !model.service
          "
        >
          <legend class="cf-sr-only">New Council task</legend>
          <label class="cf-field"
            ><span>Task title</span
            ><input
              v-model="model.store.taskTitle"
              required
              maxlength="160"
              placeholder="What decision do you need help with?"
          /></label>
          <label class="cf-field"
            ><span>Your question or task</span
            ><textarea
              v-model="model.store.taskQuestion"
              required
              maxlength="60000"
              rows="6"
              placeholder="Explain the situation, constraints and the advice or opinions you need."
            />
          </label>
          <VaultFilePicker v-model="model.store.taskQuestion" :list-files="model.listVaultFiles" />
          <div class="cf-council-fields">
            <label class="cf-field"
              ><span>Council</span
              ><select v-model="model.store.taskCouncil">
                <option value="">Select council</option>
                <option
                  v-for="entry in model.ask.councils"
                  :key="entry.definition.id"
                  :value="entry.definition.id"
                >
                  {{ entry.definition.name }}
                </option>
              </select></label
            >
          </div>
          <CouncilRecipients :selection="model.ask.selection" />
          <p v-if="!model.projectId" class="cf-settings-help">
            Create or select a project before choosing its Council.
          </p>
          <p v-else-if="model.service && model.store.catalogueLoading" class="cf-settings-help" role="status">Loading saved Council configuration…</p>
          <p v-else-if="model.service && !model.store.catalogueLoaded" class="cf-settings-help">{{ model.store.catalogueError || 'Council configuration has not loaded. Refresh Council to retrieve saved definitions; availability is not inferred from an unavailable catalogue.' }} Your question is kept.</p>
          <p v-else-if="model.service && !model.ask.councils.length" class="cf-settings-help">
            No enabled Council is available for this project. Open Setup → Councils &amp; roster to
            configure its members and discussion rounds. Your question stays here.
          </p>
          <p class="cf-settings-help">
            Saving creates a private task note. It does not submit a run,
            contact a provider or resume execution.
          </p>
          <div class="cf-settings-actions">
            <button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="!model.ask.canSave"
            >
              {{
                model.store.busy ? "Working…" : "Save task and review"
              }}</button
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.ask.newTask()"
            >
              Start a new task
            </button>
          </div>
        </fieldset>
      </form>
      <div class="cf-settings-actions">
        <button
          v-if="!model.projectId"
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.studio.navigate('projects')"
        >
          Manage projects</button
        ><button
          v-if="model.service"
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.selectPage('definitions')"
        >
          Set up councils
        </button>
      </div>
    </section>
    <CouncilSubmission
      v-if="
        model.service &&
        model.store.taskSource &&
        model.store.source === model.store.taskSource
      "
      task-intake
    />
    <CouncilExecutionControls v-if="model.service && model.ask.executionNeeded" />
    <section class="cf-council-task-history" aria-label="Council task history">
      <header>
        <h2>Task history</h2>
        <p>
          Saved questions and retained runs. Every submission generation stays separate;
          switch scope to find work from another project.
        </p>
      </header>
      <label class="cf-field"><span>Show tasks</span><select v-model="model.store.taskHistoryScope" aria-label="Task history scope"><option value="project">This project</option><option value="all">All projects and inbox observations</option></select></label>
      <p v-if="model.store.taskHistoryError" role="alert">
        {{ model.store.taskHistoryError }}
      </p>
      <p v-else-if="!model.store.tasksLoaded" class="cf-settings-help">
        Saved task notes have not loaded. Refresh Council to retrieve them;
        retained runs are shown when available.
      </p>
      <label class="cf-field"
        ><span>Find a Council task</span
        ><input
          v-model="model.ask.search"
          type="search"
          placeholder="Title, source, project or status"
      /></label>
      <p v-if="!model.ask.matchingCount">
        {{
          model.ask.historyCount
            ? "No tasks match this search."
            : model.store.tasksLoaded
              ? "No tasks yet. Write a question above or submit an existing private note."
              : "No retained runs are currently available."
        }}
      </p>
      <ol
        v-else
        class="cf-council-task-list"
        tabindex="0"
        aria-label="Retained Council task records"
      >
        <li v-for="item in model.ask.history" :key="item.id">
          <div>
            <strong>{{ item.title }}</strong>
            <p class="cf-council-task-source">
              <code>{{ item.source }}</code
              ><span>{{
                item.projectId || "Inbox observation · project not established"
              }}</span>
            </p>
            <p>{{ item.detail }}</p>
          </div>
          <div class="cf-council-task-outcome">
            <span class="cf-badge">{{ item.status }}</span
            ><time v-if="item.at" :datetime="item.at">{{
              model.ask.when(item.at)
            }}</time
            ><span v-else>Latest inbox observation</span>
          </div>
          <button
            v-if="item.runId"
            type="button"
            class="cf-btn cf-btn-secondary"
            :aria-label="item.canReadAnswers ? `Read answers for ${item.title}` : `Inspect task ${item.title}`"
            @click="model.ask.inspect(item)"
          >
            {{ item.canReadAnswers ? 'Read answers' : 'Inspect task' }}
          </button>
          <button
            v-else-if="item.task"
            type="button"
            class="cf-btn cf-btn-secondary"
            :aria-label="`Review saved task ${item.title}`"
            :disabled="model.store.busy"
            @click="model.ask.review(item.task)"
          >
            Review saved task
          </button>
        </li>
      </ol>
      <button
        v-if="model.ask.more"
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.ask.showMore()"
      >
        Show 50 more tasks
      </button>
      <p class="cf-settings-help">
        Inbox observations reflect the latest reconciliation and are not
        admission records. Cleared history is not reconstructed.
      </p>
    </section>
  </div>
</template>
