<script setup lang="ts">
import { useRequestDeletion } from '../../composables/coforge/use-request-deletion';
const model = useRequestDeletion();
</script>
<template>
  <div class="cf-overlay cf-help-overlay" @mousedown="model.focus.backdrop">
    <section :ref="model.focus.bind" class="cf-help-dialog cf-request-deletion-dialog" role="alertdialog" aria-modal="true" aria-label="Delete request" :aria-describedby="model.effectsId" @keydown="model.focus.keydown">
      <header><h2>Delete request?</h2></header>
      <p v-if="model.idea"><code>{{ model.idea.id }}</code> · <strong>{{ model.idea.title }}</strong></p>
      <p v-if="model.preview">Project <code>{{ model.preview.projectId }}</code></p>
      <p :id="model.effectsId">Remove this request from the board using your Obsidian deletion preference. A private recovery copy and execution/cost history are retained. Worktrees and code changes are kept.</p>
      <p v-if="model.working === 'preview'" role="status">Preparing the deletion preview…</p>
      <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
      <p v-else-if="model.problem" class="cf-inline-error" role="alert">{{ model.problem }}</p>
      <div class="cf-settings-actions">
        <button data-request-delete-cancel type="button" class="cf-btn cf-btn-secondary" :disabled="model.working === 'delete'" @click="model.close()">Keep request</button>
        <button v-if="!model.preview && !model.working" type="button" class="cf-btn cf-btn-secondary" @click="model.prepare()">Refresh deletion preview</button>
        <button type="button" class="cf-btn cf-btn-danger" :disabled="!model.canDelete" @click="model.confirm()">{{ model.working === 'delete' ? 'Deleting…' : 'Delete request' }}</button>
      </div>
    </section>
  </div>
</template>
