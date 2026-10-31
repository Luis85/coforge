<script setup lang="ts">
import { useWorkflowStartup } from '../../composables/coforge/use-workflow-startup';
const startup = useWorkflowStartup();
</script>
<template>
  <label class="cf-field"><span>Idea board automation on startup</span>
    <select v-model="startup" aria-label="Idea board automation on startup" data-workflow-field="startupMode">
      <option value="paused">Start paused</option>
      <option value="play">Start playing</option>
    </select>
    <small>Applies when CoForge reopens after you save this workflow. Saving does not change the current Play/Pause state. Interrupted or uncertain attempts still require recovery; Council and event automation keep their own startup rules.</small>
  </label>
</template>
