<script setup lang="ts">
import { useSettings } from '../../composables/coforge/use-settings';
import { useSettingsNavigation } from '../../composables/coforge/use-settings-navigation';
import CfIcon from './CfIcon.vue';
import SettingsGeneralSection from './SettingsGeneralSection.vue';
import SettingsDataSection from './SettingsDataSection.vue';
import SettingsRuntimeSection from './SettingsRuntimeSection.vue';
import SettingsRepositorySection from './SettingsRepositorySection.vue';
import SettingsRequestObjectSection from './SettingsRequestObjectSection.vue';
import SettingsSaveBar from './SettingsSaveBar.vue';
import WorkflowView from './WorkflowView.vue';
const model = useSettings();
const navigation = useSettingsNavigation(model);
</script>
<template>
  <div class="cf-settings-page">
    <header class="cf-page-heading">
      <div>
        <h1>Project settings</h1>
        <p>Manage your project, request format and agent workflow.</p>
      </div>
      <span class="cf-settings-local-label"><CfIcon name="shield-check" size="sm" /> Private configuration</span>
    </header>
    <div class="cf-settings-layout">
      <nav class="cf-settings-navigation" aria-label="Project settings pages">
        <button v-for="item in navigation.items" :key="item.id" type="button" :aria-labelledby="`${model.store.layoutId}-settings-${item.id}-label ${model.store.layoutId}-settings-${item.id}-description`" :aria-current="model.store.settingsTool === item.id ? 'page' : undefined" @click="navigation.select(item.id)">
          <CfIcon :name="item.icon" />
          <span><strong :id="`${model.store.layoutId}-settings-${item.id}-label`">{{ item.label }}</strong><small :id="`${model.store.layoutId}-settings-${item.id}-description`">{{ item.description }}</small></span>
          <CfIcon name="chevron-right" size="xs" class="cf-settings-nav-arrow" />
        </button>
      </nav>
      <div class="cf-settings-content">
        <div v-if="model.error" class="cf-settings-alert is-error" role="alert">
          <CfIcon name="circle-alert" />
          <span>{{ model.error }}<small v-if="model.dirty">Your draft is kept while you review General, Requests and Repository.</small></span>
        </div>
        <section v-if="!model.availableProject && !model.dirty && !['data', 'workflow'].includes(model.store.settingsTool)" class="cf-empty-state" aria-label="Choose a project for settings">
          <h2>Choose a project</h2>
          <p>Add or select an available project to configure its workspace and workflow.</p>
          <button type="button" class="cf-btn cf-btn-primary" @click="model.store.navigate('projects')">Manage projects</button>
        </section>
        <template v-else>
          <form :id="navigation.formId" class="cf-settings-form" @submit="model.submit">
            <fieldset v-if="navigation.formPage" class="cf-project-config-fields" :disabled="model.saving">
              <legend class="cf-sr-only">Project configuration</legend>
              <SettingsGeneralSection v-if="model.store.settingsTool === 'general'" />
              <template v-else-if="model.store.settingsTool === 'requests'">
                <SettingsRequestObjectSection />
                <p class="cf-settings-help cf-settings-related-help">Viewer feature requests have a fixed 5-minute cooldown across all projects. Manage registration under Viewers, prices and rewards under Economy, and XP and ranks under Community settings.</p>
              </template>
              <SettingsRepositorySection v-else-if="model.store.settingsTool === 'repository'" />
            </fieldset>
          </form>
          <WorkflowView v-if="model.store.settingsTool === 'workflow'" embedded />
          <SettingsRuntimeSection v-else-if="model.store.settingsTool === 'runtime'" />
          <SettingsDataSection v-else-if="model.store.settingsTool === 'data' && model.store.state" />
          <SettingsSaveBar v-if="model.dirty || navigation.formPage" :form-id="navigation.formId" />
        </template>
      </div>
    </div>
  </div>
</template>
