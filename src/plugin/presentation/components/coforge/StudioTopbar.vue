<script setup lang="ts">
import { useStudioShell } from "../../composables/coforge/use-studio-app";
import CfIcon from "./CfIcon.vue";

const model = useStudioShell();
</script>
<template>
  <header class="cf-topbar">
    <div class="cf-breadcrumb">
      <button
        type="button"
        class="cf-icon-button cf-panel-toggle"
        :aria-label="
          model.store.leftPanelCollapsed
            ? 'Expand navigation panel'
            : 'Collapse navigation panel'
        "
        :aria-expanded="!model.store.leftPanelCollapsed"
        :aria-controls="`${model.store.layoutId}-navigation`"
        @click="
          model.store.leftPanelCollapsed = !model.store.leftPanelCollapsed
        "
      >
        <CfIcon
          :name="
            model.store.leftPanelCollapsed
              ? 'panel-left-open'
              : 'panel-left-close'
          "
        />
      </button>
      <CfIcon :name="model.projectScoped ? 'gamepad-2' : 'layers'" size="sm" />
      <span>{{ model.scopeLabel }}</span>
      <button
        v-if="model.projectScoped && model.store.activeProject"
        type="button"
        class="cf-project-id-copy"
        :aria-label="`Copy project ID ${model.store.activeProject.id}`"
        @click="model.copyProjectId()"
      >
        <code>{{ model.store.activeProject.id }}</code
        ><CfIcon name="copy" size="xs" />
      </button>
      <CfIcon name="chevron-right" size="xs" />
      <strong>{{ model.viewLabel }}</strong>
    </div>
    <div class="cf-topbar-actions">
      <button
        v-if="model.chatVisible && model.store.view === 'board'"
        type="button"
        class="cf-icon-button cf-panel-toggle"
        :aria-label="
          model.store.rightPanelCollapsed
            ? 'Expand chat panel'
            : 'Collapse chat panel'
        "
        :aria-expanded="!model.store.rightPanelCollapsed"
        :aria-controls="`${model.store.layoutId}-chat`"
        @click="model.toggleRightPanel()"
      >
        <CfIcon
          :name="
            model.store.rightPanelCollapsed
              ? 'panel-right-open'
              : 'panel-right-close'
          "
        />
      </button>
      <span
        v-if="model.projectScoped && model.store.activeProject"
        class="cf-provider-pill"
        :class="{ 'is-demo': model.isDemo }"
        :title="model.providerSummary.title"
        ><span />{{ model.providerSummary.label }}</span
      >
      <span class="cf-topbar-divider" />
      <button
        type="button"
        class="cf-icon-button cf-activity-toggle"
        aria-label="Recent activity"
        :aria-expanded="model.store.activityOpen"
        @click="model.store.activityOpen = !model.store.activityOpen"
      >
        <CfIcon name="activity" />
        <span v-if="model.reviewCount > 0" class="cf-notification-dot" />
      </button>
    </div>
  </header>
</template>
