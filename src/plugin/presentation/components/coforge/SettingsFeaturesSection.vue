<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import { STUDIO_GROUPS } from '../../stores/studio-destinations';
const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" :aria-labelledby="`${model.store.layoutId}-features-heading`">
    <div class="cf-settings-description">
      <h2 :id="`${model.store.layoutId}-features-heading`">Project features</h2>
      <p>Choose the groups you want to see in this project's workspace.</p>
    </div>
    <fieldset class="cf-settings-fields cf-project-feature-fields" :aria-describedby="`${model.store.layoutId}-features-help`">
      <legend class="cf-sr-only">Visible feature groups</legend>
      <label v-for="group in STUDIO_GROUPS" :key="group.id" class="cf-project-repository-toggle">
        <input v-model="model.featureGroups" type="checkbox" :value="group.id" :aria-label="`Show ${group.label} features`" />
        <span>{{ group.label }}</span>
      </label>
      <p :id="`${model.store.layoutId}-features-help`" class="cf-settings-help">Hidden groups and their panels stay out of this workspace. Shared services and background work keep running. Project settings and the project switcher stay available.</p>
    </fieldset>
  </section>
</template>
