<script setup lang="ts">
import { useTaskSchedulerForm } from '../../composables/coforge/use-task-scheduler';
import TaskTimingFields from './TaskTimingFields.vue';
const model = useTaskSchedulerForm();
</script>
<template>
  <form v-if="model.store.form" class="cf-council-section" aria-label="Scheduled task settings" @submit="model.save">
    <fieldset class="cf-task-form" :disabled="model.store.busy || !model.canManage">
      <legend>{{ model.store.form.id ? 'Edit task schedule' : 'New task schedule' }}</legend>
      <label class="cf-field"><span>Task name</span><input v-model="model.store.form.title" required maxlength="100"></label>
      <div class="cf-council-fields">
        <label class="cf-field"><span>Project</span><select v-model="model.store.form.projectId" required @change="model.projectChanged()"><option value="">Select project</option><option v-for="project in model.projects" :key="project.id" :value="project.id">{{ project.id }} · {{ project.settings.projectName }}</option></select></label>
        <label class="cf-field"><span>Project team</span><select v-model="model.store.form.teamId" required @change="model.recipientChanged()"><option value="">Select team</option><option v-for="team in model.teams" :key="team.id" :value="team.id">{{ team.name }}</option></select></label>
      </div>
      <p v-if="!model.teams.length" class="cf-settings-help">Create an available project team in Definitions and its CoWorkers in CoWorkers before scheduling work.</p>
      <div class="cf-council-fields">
        <label class="cf-field"><span>Route to</span><select v-model="model.store.form.kind" @change="model.recipientChanged()"><option value="agent">CoWorker</option><option value="team">Team · assigned member</option><option value="council">Council</option></select></label>
        <label class="cf-field"><span>{{ model.store.form.kind === 'team' ? 'Assigned team member' : model.store.form.kind === 'council' ? 'Council' : 'CoWorker' }}</span><select v-model="model.store.form.recipient" required><option value="">Select recipient</option><option v-for="entry in model.recipients" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label>
      </div>
      <p v-if="model.store.form.kind === 'team'" class="cf-settings-help">Only the selected member receives the task. Other team members are not awakened.</p>
      <label class="cf-field"><span>Task prompt</span><textarea v-model="model.store.form.prompt" rows="5" maxlength="8000" required placeholder="Describe what the recipient should do and the result you need."></textarea></label>
      <label class="cf-field"><span>Context notes · optional, one vault-relative Markdown path per line</span><textarea v-model="model.store.form.contexts" rows="3" maxlength="10000" placeholder="Private/Architecture.md"></textarea></label>
      <p class="cf-settings-help">Each occurrence captures the current prompt, selected notes and recipient definitions. Existing runs keep their original snapshots and limits.</p>
      <TaskTimingFields />
      <label class="cf-check"><input v-model="model.store.form.enabled" type="checkbox"> Enable future scheduling</label>
      <p class="cf-settings-help">Only the designated open desktop executes tasks. Missed occurrences and overlaps are skipped with a recorded reason. Saving a paused schedule does not start work.</p>
      <label v-if="model.needsAcknowledgement(model.store.form.id)" class="cf-check"><input v-model="model.store.form.acknowledge" type="checkbox"> I inspected the uncertain occurrence, its source and run, and stopped or resolved any unknown work. Enable future scheduling without replaying it.</label>
      <div class="cf-settings-actions"><button type="submit" class="cf-btn cf-btn-primary">Save schedule</button><button type="button" class="cf-btn cf-btn-secondary" @click="model.cancel()">Discard draft</button></div>
    </fieldset>
  </form>
</template>
