<script setup lang="ts">
import { useBoardWelcome } from '../../composables/coforge/use-board-welcome';
import CfIcon from './CfIcon.vue';

const model = useBoardWelcome();
</script>
<template>
  <div :ref="model.bind" class="cf-board-empty cf-board-welcome">
    <CfIcon name="lightbulb" />
    <h2>Your next game starts with an idea.</h2>
    <p>
      Every idea becomes a Markdown note in your vault<template v-if="model.folder"> under <code>{{ model.folder }}</code></template>,
      with its votes, score, plan and review saved alongside. Add the first one, type <code>!request</code> in the stream chat,
      or explore the full loop with the sample workspace.
    </p>
    <div v-if="!model.confirming" class="cf-board-welcome-actions">
      <button type="button" class="cf-btn cf-btn-secondary cf-board-sample-ask" :disabled="model.store.busy" @click="model.ask()">
        <CfIcon name="sparkles" /> Load sample workspace
      </button>
      <button type="button" class="cf-btn cf-btn-primary" @click="model.startNew()">
        <CfIcon name="plus" /> New idea
      </button>
    </div>
    <div v-else class="cf-board-sample-confirm" role="group" aria-labelledby="cf-board-sample-warning">
      <p id="cf-board-sample-warning">
        The sample replaces this project’s settings, chat and contributors. Any existing idea notes are moved to the vault trash.
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
