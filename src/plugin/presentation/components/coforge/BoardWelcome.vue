<script setup lang="ts">
import { useBoardWelcome } from '../../composables/coforge/use-board-welcome';
import CfIcon from './CfIcon.vue';

const model = useBoardWelcome();
</script>
<template>
  <div :ref="model.bind" class="cf-board-empty cf-board-welcome">
    <CfIcon name="lightbulb" />
    <h2>No requests for this project</h2>
    <p v-if="model.store.activeProject?.visibility === 'private'">Add an owner request here. Private projects do not accept viewer chat requests.</p>
    <p v-else>
      Add a request here, or use <code>!request &lt;project-id&gt; &lt;idea&gt;</code> or <code>!bug &lt;project-id&gt; &lt;bug&gt;</code> in chat.
    </p>
    <div v-if="!model.confirming" class="cf-board-welcome-actions">
      <button type="button" class="cf-btn cf-btn-secondary cf-board-sample-ask" :disabled="model.store.busy" @click="model.ask()">
        <CfIcon name="sparkles" /> Load sample workspace
      </button>
      <button type="button" class="cf-btn cf-btn-primary" @click="model.startNew()">
        <CfIcon name="plus" /> New request
      </button>
    </div>
    <div v-else class="cf-board-sample-confirm" role="group" aria-labelledby="cf-board-sample-warning">
      <p id="cf-board-sample-warning">
        The sample replaces this project’s settings and requests. Its existing idea notes are moved to the vault trash; other projects and shared chat are kept.
      </p>
      <div class="cf-board-welcome-actions">
        <button type="button" class="cf-btn cf-btn-ghost cf-board-sample-cancel" @click="model.cancel()">Cancel</button>
        <button type="button" class="cf-btn cf-btn-danger" :disabled="model.store.busy" @click="model.replace()">
          <CfIcon v-if="model.store.busy" name="loader-circle" class="cf-spin" /> Replace with sample
        </button>
      </div>
    </div>
  </div>
</template>
