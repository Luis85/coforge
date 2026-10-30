<script setup lang="ts">
import { useSettingsFeatures } from '../../composables/coforge/use-settings-features';
const features = useSettingsFeatures();
const model = features.model;
</script>
<template>
  <section class="cf-settings-section" :aria-labelledby="`${model.store.layoutId}-features-heading`">
    <div class="cf-settings-description">
      <h2 :id="`${model.store.layoutId}-features-heading`">Project features</h2>
      <p>Choose the capabilities you want to see in this project's workspace.</p>
    </div>
    <fieldset class="cf-settings-fields cf-project-feature-fields" :aria-describedby="`${model.store.layoutId}-features-help`">
      <legend class="cf-sr-only">Visible feature groups</legend>
      <div v-for="group in features.groups" :key="group.id" class="cf-project-feature-group">
        <label class="cf-project-repository-toggle cf-project-feature-heading">
          <input v-model="model.featureGroups" type="checkbox" :value="group.id" :aria-label="`Show ${group.label} features`" />
          <strong>{{ group.label }}</strong><small>{{ group.enabled ? `${group.selected} of ${group.features.length} selected` : 'Group hidden' }}</small>
        </label>
        <fieldset class="cf-project-feature-options" :disabled="!group.enabled">
          <legend class="cf-sr-only">{{ group.label }} features</legend>
          <label v-for="feature in group.features" :key="feature.id" class="cf-project-feature-option">
            <input v-model="model.features" type="checkbox" :value="feature.id" :aria-label="`Show ${feature.label}`" />
            <span><strong>{{ feature.label }}</strong><small>{{ feature.description }}</small></span>
          </label>
        </fieldset>
      </div>
      <p :id="`${model.store.layoutId}-features-help`" class="cf-settings-help">Hiding a group keeps its individual choices. Shared services, saved data and background work keep their existing behavior. Project settings and the project switcher stay available.</p>
    </fieldset>
  </section>
</template>
