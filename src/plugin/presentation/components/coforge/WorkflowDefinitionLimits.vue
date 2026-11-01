<script setup lang="ts">
import { MANAGED_NATIVE_SESSION_HELP } from '../../composables/coforge/workflow-session-display';
</script>
<template>
  <section class="cf-idea-section" aria-label="Managed agent behavior">
    <h3>Follow the agent</h3>
    <p class="cf-settings-help">{{ MANAGED_NATIVE_SESSION_HELP }}</p>
    <p class="cf-settings-help">New Claude Code and Codex tasks need no elapsed deadline, turn limit or spending cap in CoForge. Your provider’s account limits still apply. Earlier attempts retain their recorded execution policy.</p>
    <p class="cf-settings-help">Open a request’s Sessions tab to follow its messages and tool activity. A result moves to review; an interrupted connection keeps the available evidence and changes.</p>
  </section>
</template>
