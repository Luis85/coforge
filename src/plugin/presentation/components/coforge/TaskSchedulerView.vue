<script setup lang="ts">
import { useTaskScheduler } from '../../composables/coforge/use-task-scheduler';
import TaskSchedulerForm from './TaskSchedulerForm.vue';
const model = useTaskScheduler();
</script>
<template>
  <section class="cf-council-section" aria-label="Task scheduler">
    <header class="cf-page-heading"><div><h2>Task scheduler</h2><p>Recurring prompts, timers and scheduled reviews for agents, assigned team members and councils.</p></div>
      <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.available || model.store.busy" @click="model.refresh()">Refresh schedules</button><button type="button" class="cf-btn cf-btn-primary" :disabled="!model.canManage || model.store.busy || !!model.store.form" @click="model.create()">New scheduled task</button></div>
    </header>
    <p v-if="!model.available">Open CoForge in desktop Obsidian to save and run private task schedules. Configure teams, agents and councils in Definitions.</p>
    <button v-if="!model.available && model.canPreview" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.explore()">Explore scheduler example</button>
    <p v-if="model.store.example" role="status">Scheduler example · in-memory schedules and simulated admission receipts only. No vault files, native agents or external services are changed.</p>
    <button v-if="model.store.example" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.exitExample()">Exit scheduler example</button>
    <template v-if="model.available">
      <p v-if="!model.store.state">Loading task schedules…</p>
      <p v-if="!model.canManage">Designate this desktop in Run monitor before creating or changing schedules. <button type="button" class="cf-btn cf-btn-secondary" @click="model.openMonitor()">Open Run monitor</button></p>
      <p v-else-if="model.executionPaused">Council execution is paused. Due occurrences will be skipped until you explicitly resume in Run monitor. <button type="button" class="cf-btn cf-btn-secondary" @click="model.openMonitor()">Open Run monitor</button></p>
      <p v-if="model.store.error || model.store.state?.error" role="alert" class="cf-inline-error">{{ model.store.error || model.store.state?.error }}</p>
      <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
      <div class="cf-settings-actions"><label class="cf-field"><span>Show project</span><select v-model="model.store.projectFilter"><option value="">All projects</option><option v-for="project in model.projects" :key="project.id" :value="project.id">{{ project.id }} · {{ project.settings.projectName }}</option></select></label><label class="cf-check"><input v-model="model.store.showArchived" type="checkbox"> Show archived schedules</label></div>
      <TaskSchedulerForm />
      <p v-if="!model.tasks.length && !model.store.form">No schedules in this view. Create a task, choose its recipient and timing, then enable it when ready.</p>
      <ul class="cf-council-runs" aria-label="Saved task schedules">
        <li v-for="task in model.tasks" :key="task.id">
          <h3>{{ task.title }}</h3><p>{{ task.projectId }} · {{ model.targetLabel(task) }}</p><p>{{ model.timingLabel(task) }}</p>
          <p>{{ task.archived ? 'Archived' : task.enabled ? 'Enabled' : 'Paused' }} · Next: {{ task.archived || !task.enabled ? 'Not scheduled while paused' : model.when(task.nextDueAt, task) }}</p>
          <p v-if="model.needsAcknowledgement(task.id)" role="status">An occurrence needs inspection. Open its source and run below, then edit this schedule to acknowledge recovery.</p>
          <div class="cf-settings-actions">
            <template v-if="!task.archived"><button type="button" class="cf-btn" :disabled="!model.canManage || model.store.busy" :aria-label="`Edit ${task.title}`" @click="model.edit(task)">Edit</button><button type="button" class="cf-btn" :disabled="!model.canManage || model.store.busy" :aria-label="`${task.enabled ? 'Pause' : 'Resume'} ${task.title}`" @click="model.toggle(task)">{{ task.enabled ? 'Pause' : 'Resume' }}</button><button type="button" class="cf-btn" :disabled="!model.canManage || model.store.busy || model.executionPaused || model.needsAcknowledgement(task.id)" :aria-label="`Run ${task.title} now`" @click="model.runNow(task)">Run now</button><button type="button" class="cf-btn" :disabled="!model.canManage || model.store.busy" :aria-label="`Archive ${task.title}`" @click="model.archive(task)">Archive</button></template>
            <button v-else type="button" class="cf-btn" :disabled="!model.canManage || model.store.busy" @click="model.restore(task)">Restore paused schedule</button>
          </div>
        </li>
      </ul>
      <section class="cf-council-section" aria-label="Scheduled occurrence history"><h3>Recent occurrences</h3><p>Latest 30 in this view. Submitted means admitted to the shared kernel, not completed. Sources and Run monitor retain execution evidence.</p>
        <p v-if="!model.occurrences.length">No occurrences recorded yet.</p>
        <ul class="cf-council-runs"><li v-for="item in model.occurrences" :key="item.id"><strong>{{ item.snapshot.title }}</strong><p>{{ item.snapshot.projectId }} · {{ model.when(item.dueAt) }} · {{ model.occurrenceLabel(item) }}</p><p>{{ item.message }}</p><div v-if="!model.store.example" class="cf-settings-actions"><button v-if="item.sourcePath" type="button" class="cf-btn" :disabled="model.store.busy" @click="model.openSource(item)">Open source and results</button><button v-if="item.runId" type="button" class="cf-btn" @click="model.openRun(item)">Inspect run</button></div></li></ul>
      </section>
    </template>
  </section>
</template>
