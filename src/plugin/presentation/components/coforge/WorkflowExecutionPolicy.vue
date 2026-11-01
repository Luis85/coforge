<script setup lang="ts">
import { MANAGED_NATIVE_SESSION_HELP } from '../../composables/coforge/workflow-session-display';
</script>
<template>
  <section class="cf-idea-section" aria-label="Agent session behavior">
    <h3>Agent session</h3>
    <p class="cf-settings-help">For Claude Code and Codex: {{ MANAGED_NATIVE_SESSION_HELP }}</p>
  </section>
</template>
